import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MigrationsService } from '../repository/migrations/migrations.service';
import { SupabaseService } from '../supabase/supabase.service';
import { FacilityService } from '../repository/facility/facility.service';
import { UnitService } from '../repository/unit/unit.service';
import * as csvParse from 'csv-parse/sync';
import * as iconv from 'iconv-lite';
import { TenantService } from '../repository/tenant/tenant.service';
import { RentalContractService } from '../repository/rentalcontract/rentalcontract.service';
import { RentalInvoiceService } from '../repository/rentalinvoice/rentalinvoice.service';
import { LogsService } from '../repository/logs/logs.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly migrationsService: MigrationsService,
    private readonly supabaseService: SupabaseService,
    private readonly facilityService: FacilityService,
    private readonly unitService: UnitService,
    private readonly tenantService: TenantService,
    private readonly rentalContractService: RentalContractService,
    private readonly rentalInvoiceService: RentalInvoiceService,
    private readonly logsService: LogsService,
  ) {}

  @Cron('*/60 * * * * *')
  async handleJobs() {
    await this.unitJob();
    await this.rentRollJob();
  }

  private async createLogApi(level: string, context: string, message: string) {
    try {
      await fetch('https://etlchallenge-production.up.railway.app/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level, context, message }),
      });
    } catch (err) {
      this.logger.error(`Error to Call Logs Api: ${err?.message || err}`);
    }
  }

  async unitJob() {
    this.logger.log(`UnitJob: Starting job to process unit migrations.`);
    await this.createLogApi('info', 'UnitJob', 'Starting job to process unit migrations.');

    const migrations = await this.migrationsService.findByStatusAndFiletype(
      'new',
      'unit',
    );
    if (migrations.length === 0) {
      this.logger.log('UnitJob: No new unit migrations found.');
      await this.createLogApi('info', 'UnitJob', 'No new unit migrations found.');
      return;
    }
    for (const migration of migrations) {
      let total = 0, inseridas = 0, ignoradas = 0, erros = 0;
      const detalhes: string[] = [];
      await this.migrationsService.updateFieldsById(
        migration.migrationscontrolid,
        { status: 'processing', startprocessing: new Date().toISOString() },
      );

      // INÍCIO DA TRANSAÇÃO
      const trx = await this.facilityService.getTransaction();
      try {
        // Download e parse do arquivo
        const fileBuffer = await this.supabaseService.downloadFile(
          'importedcsv',
          migration.filename,
        );
        const encodings = ['utf-8', 'latin1', 'ascii'];
        let csvContent: string | null = null;
        const arrayBuffer = await fileBuffer.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        for (const encoding of encodings) {
          try {
            csvContent = iconv.decode(buffer, encoding);
            break;
          } catch {
            csvContent = null;
          }
        }
        if (!csvContent) {
          this.logger.error(
            `UnitJob: Failed to decode file ${migration.filename} with all encodings.`,
          );
          await this.createLogApi('error', 'UnitJob', `Failed to decode file ${migration.filename} with all encodings.`);
          throw new Error('Error to decode file. Not supported encoding.');
        }

        const records = parseCsv(csvContent);

        // Facilities e units
        const uniqueFacilities = Array.from(
          new Set(records.map((r) => r.facilityName)),
        );
        for (const facilityName of uniqueFacilities) {
          // Passa a transação para o service!
          const facility = await this.facilityService.createIfNotExists(
            facilityName,
            trx
          );
          const units = records.filter((r) => r.facilityName === facilityName);
          for (const [idx, unit] of units.entries()) {
            total++;
            // Validação básica dos campos obrigatórios
            const required = ['facilityName', 'unitNumber', 'unitSize', 'unitType'];
            let missing = required.filter(
              (key) => !unit[key] || String(unit[key]).trim() === '',
            );
            if (missing.length > 0) {
              detalhes.push(
                `Line ${idx + 2}: Missing Required Field(s): ${missing.join(', ')}`,
              );
              erros++;
              continue;
            }
            // Parse unitSize
            const [unitwidth, unitlength, unitheight] = parseUnitSize(unit.unitSize);
            if (!unitwidth || !unitlength || !unitheight) {
              detalhes.push(
                `Line ${idx + 2}: Invalid unitSize format (${unit.unitSize})`,
              );
              erros++;
              continue;
            }
            // Verifica duplicidade
            const exists = await this.unitService.getUnitByFacilityAndNumber(
              facility,
              unit.unitNumber,
            );
            if (exists) {
              detalhes.push(
                `Line ${idx + 2}: Duplicated unit ignored (facility: ${facility}, number: ${unit.unitNumber})`,
              );
              ignoradas++;
              continue;
            }
            try {
              await this.unitService.createUnit({
                facility_facilityid: facility,
                number: unit.unitNumber,
                unitwidth,
                unitlength,
                unitheight,
                unittype: unit.unitType,
              }, trx); // Passe a transação!
              inseridas++;
              detalhes.push(`Line ${idx + 2}: Successfully processed.`);
            } catch (err) {
              detalhes.push(
                `Line ${idx + 2}: Error inserting unit: ${err.message || err}`,
              );
              erros++;
            }
          }
        }

        // Determina o status final conforme regras
        let finalStatus = 'Success';
        if (erros > 0 && ignoradas > 0) {
          finalStatus = 'Processed With Ignored and Errors';
        } else if (erros > 0) {
          finalStatus = 'Processed With Errors';
        } else if (ignoradas > 0) {
          finalStatus = 'Processed With Ignored';
        }

        await trx.commit();

        // Atualiza status para o resultado final
        await this.migrationsService.updateFieldsById(
          migration.migrationscontrolid,
          {
            status: finalStatus,
            endprocessing: new Date().toISOString(),
            msg: `Processed: ${inseridas}, Ignored: ${ignoradas}, Errors: ${erros}`,
          },
        );

        // Log detalhado
        this.logger.log(
          `UnitJob: ${migration.filename} - Total: ${total}, Inserted: ${inseridas}, Ignored: ${ignoradas}, Errors: ${erros}`,
        );
        await this.createLogApi(
          'info',
          'UnitJob',
          `${migration.filename} - Total: ${total}, Inserted: ${inseridas}, Ignored: ${ignoradas}, Errors: ${erros}`,
        );

        for (const msg of detalhes) {
          this.logger.log(msg);
          await this.createLogApi('info', 'UnitJob', msg);
        }
      } catch (err) {
        await trx.rollback();
        this.logger.error(
          `UnitJob: Error processing file ${migration.filename}: ${err}`,
        );
        await this.createLogApi(
          'error',
          'UnitJob',
          `Error processing file ${migration.filename}: ${err}`,
        );
      }
    }
  }

  async rentRollJob() {
    this.logger.log('RentRollJob: Starting the Rent Roll Migration Process.');
    await this.createLogApi('info', 'RentRollJob', 'Starting the Rent Roll Migration Process.');

    const migrations = await this.migrationsService.findByStatusAndFiletype('new', 'rentRoll');
    if (migrations.length === 0) {
      this.logger.log('RentRollJob: No new rentRoll migrations found.');
      await this.createLogApi('info', 'RentRollJob', 'No new rentRoll migrations found.');
      return;
    }

    for (const migration of migrations) {
      let total = 0, inseridas = 0, ignoradas = 0, erros = 0;
      const detalhes: string[] = [];
      // Atualiza status para processing
      await this.migrationsService.updateFieldsById(migration.migrationscontrolid, {
        status: 'processing',
        startprocessing: new Date().toISOString(),
      });

      try {
        // Download e parse do arquivo
        const fileBuffer = await this.supabaseService.downloadFile('importedcsv', migration.filename);
        const encodings = ['utf-8', 'latin1', 'ascii'];
        let csvContent: string | null = null;
        const arrayBuffer = await fileBuffer.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        for (const encoding of encodings) {
          try {
            csvContent = iconv.decode(buffer, encoding);
            break;
          } catch {
            csvContent = null;
          }
        }
        if (!csvContent) throw new Error('Error to decode file. Not supported encoding.');
        const records = parseCsv(csvContent);

        for (const [idx, row] of records.entries()) {
          total++;
          // Validação básica
          const validation = validateRentRollRow(row);
          if (!validation.success) {
            detalhes.push(`Line ${idx + 2}: Erro of validation: ${validation.message}`);
            erros++;
            continue;
          }

          // Transação por linha
          const trx = await this.facilityService.getTransaction();
          try {
            // 1. Buscar unitId pelo facilityName + unitNumber
            const facility = await trx('facility').where({ name: row.facilityName }).first();
            if (!facility) {
              detalhes.push(`Line ${idx + 2}: Facility  not found (${row.facilityName})`);
              ignoradas++;
              await trx.rollback();
              continue;
            }
            const unit = await trx('unit')
              .where({ facility_facilityid: facility.facilityid, number: row.unitNumber })
              .first();
            if (!unit) {
              detalhes.push(`Line ${idx + 2}: Unit not found (${row.unitNumber})`);
              ignoradas++;
              await trx.rollback();
              continue;
            }

            // 2. Upsert tenant (firstName + lastName + email)
            const tenant = await this.tenantService.upsertTenant({
              firstname: row.firstName,
              lastname: row.lastName,
              email: row.email,
              phone: row.phone,
            }, trx);

            // 3. Verificar duplicidade de rentalContract
            const existingContract = await this.rentalContractService.findExisting(
              unit.unitid,
              tenant,
              new Date(row.rentStartDate),
              trx,
            );
            if (existingContract) {
              detalhes.push(`Line ${idx + 2}: Duplicated Contract Ignored.`);
              ignoradas++;
              await trx.rollback();
              continue;
            }

            // 4. Inserir rentalContract
            const rentalContractId = await this.rentalContractService.createRentalContract({
              unit_unitid: unit.unitid,
              tenant_tenantid: tenant,
              startdate: new Date(row.rentStartDate),
              enddate: row.rentEndDate && String(row.rentEndDate).trim() !== ''
                ? new Date(row.rentEndDate)
                : null,
              currentamountowed: parseFloat(row.currentRentOwed),
            }, trx);

            // 5. Inserir rentalInvoice
            await this.rentalInvoiceService.createRentalInvoice({
              rentalcontract_rentalcontractid: rentalContractId,
              invoiceduedate: new Date(row.currentRentOwedDueDate),
              invoiceamount: parseFloat(row.monthlyRent),
              invoicebalance: parseFloat(row.currentRentOwed),
            }, trx);

            // Atualizar o campo monthlyrent da unit
            await this.unitService.updateUnit(
              unit.facility_facilityid,
              unit.number,
              { monthlyrent: parseFloat(row.monthlyRent) }
            );

            await trx.commit();
            inseridas++;
            detalhes.push(`Line ${idx + 2}: Successfuly processed.`);
          } catch (err) {
            await trx.rollback();
            detalhes.push(`Line ${idx + 2}: Error: ${err.message || err}`);
            erros++;
          }
        }

        // Determina o status final conforme regras
        let finalStatus = 'Success';
        if (erros > 0 && ignoradas > 0) {
          finalStatus = 'Processed With Ignored and Errors';
        } else if (erros > 0) {
          finalStatus = 'Processed With Errors';
        } else if (ignoradas > 0) {
          finalStatus = 'Processed With Ignored';
        }

        // Atualiza status para o resultado final
        await this.migrationsService.updateFieldsById(migration.migrationscontrolid, {
          status: finalStatus,
          endprocessing: new Date().toISOString(),
          msg: `Processed: ${inseridas}, Ignored: ${ignoradas}, Errors: ${erros}`,
        });

        // Log detalhado
        this.logger.log(`RentRollJob: ${migration.filename} - Total: ${total}, Inserted: ${inseridas}, Ignored: ${ignoradas}, Errors: ${erros}`);
        await this.createLogApi(
          'info',
          'RentRollJob',
          `${migration.filename} - Total: ${total}, Inserted: ${inseridas}, Ignored: ${ignoradas}, Errors: ${erros}`,
        );

        for (const msg of detalhes) {
          this.logger.log(msg);
          await this.createLogApi('info', 'RentRollJob', msg);
        }
      } catch (err) {
        await this.migrationsService.updateFieldsById(migration.migrationscontrolid, {
          status: 'error',
          msg: String(err),
        });
        this.logger.error(`RentRollJob: Error to process ${migration.filename}: ${err}`);
        await this.createLogApi(
          'error',
          'RentRollJob',
          `Error to process ${migration.filename}: ${err}`,
        );
      }
    }
  }
}

// Função de validação básica para cada linha do rentroll
function validateRentRollRow(row: any): { success: boolean; message?: string } {
  const required = [
    'facilityName', 'unitNumber', 'firstName', 'lastName', 'email',
    'rentStartDate', 'monthlyRent', 'currentRentOwed', 'currentRentOwedDueDate'
    // Remova 'rentEndDate' dos obrigatórios!
  ];
  for (const key of required) {
    if (!row[key] || String(row[key]).trim() === '') {
      return { success: false, message: `Missing Required Field: ${key}` };
    }
  }
  // Datas válidas
  if (isNaN(Date.parse(row.rentStartDate))) return { success: false, message: 'rentStartDate invalid' };
  if (row.rentEndDate && isNaN(Date.parse(row.rentEndDate))) return { success: false, message: 'rentEndDate invalid' };
  if (isNaN(Date.parse(row.currentRentOwedDueDate))) return { success: false, message: 'currentRentOwedDueDate invalid' };
  // Números positivos
  if (Number(row.monthlyRent) < 0) return { success: false, message: 'monthlyRent negative' };
  if (Number(row.currentRentOwed) < 0) return { success: false, message: 'currentRentOwed negative' };
  return { success: true };
}
// Função utilitária para parsear o unitSize
function parseUnitSize(unitSize: string): [number, number, number] {
  const cleaned = unitSize
    .replace(/[^0-9xX., ]+/g, '')
    .replace(/,/g, '.')
    .replace(/\s+/g, '')
    .toLowerCase();

  const match = cleaned.match(
    /(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)/,
  );
  if (!match) return [0, 0, 0];
  return [parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3])];
}

function parseCsv(content: string): Array<any> {
  try {
    return csvParse.parse(content, {
      columns: true,
      skip_empty_lines: true,
      delimiter: ';',
      trim: true,
    });
  } catch (error) {
    throw new Error('Erro to read CSV file: ' + error);
  }
}
