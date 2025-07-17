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
  ) {}

  @Cron('*/30 * * * * *')
  async handleJobs() {
    await this.unitJob(); //Process unit migrations every 30 seconds
    await this.rentRollJob(); // Process rent roll migrations every 30 seconds
    // Aqui você pode chamar outros jobs, ex: await this.rentRollJob();
  }

  async unitJob() {
    this.logger.log(`UnitJob: Starting job to process unit migrations.`);
    const migrations = await this.migrationsService.findByStatusAndFiletype(
      'new',
      'unit',
    );
    if (migrations.length === 0) {
      this.logger.log('UnitJob: No new unit migrations found.');
      return;
    }
    for (const migration of migrations) {
      // INÍCIO DA TRANSAÇÃO
      const trx = await this.facilityService.getTransaction();
      try {
        this.logger.log(
          `UnitJob: Processing migration: ${migration.filename} with ID: ${migration.migrationscontrolid}`,
        );
        await this.migrationsService.updateFieldsById(
          migration.migrationscontrolid,
          { status: 'processing', startprocessing: new Date().toISOString() },
        );

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
          throw new Error(
            'Erro ao decodificar o arquivo. Encoding não suportado.',
          );
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
            trx,
          );
          const units = records.filter((r) => r.facilityName === facilityName);
          for (const unit of units) {
            const { unitNumber, unitSize, unitType } = unit;
            const [unitwidth, unitlength, unitheight] = parseUnitSize(unitSize);
            await this.unitService.createUnit({
              facility_facilityid: facility.facilityid,
              number: unitNumber,
              unitwidth,
              unitlength,
              unitheight,
              unittype: unitType,
            });
          }
        }

        await trx.commit(); // COMMIT se tudo deu certo

        await this.migrationsService.updateFieldsById(
          migration.migrationscontrolid,
          { status: 'success', endprocessing: new Date().toISOString() },
        );
        this.logger.log(
          `UnitJob: Successfully processed migration: ${migration.filename}`,
        );
      } catch (err) {
        await trx.rollback(); // ROLLBACK se deu erro
        this.logger.error(
          `UnitJob: Error processing file ${migration.filename}: ${err}`,
        );
        await this.migrationsService.updateFieldsById(
          migration.migrationscontrolid,
          { status: 'error', msg: String(err) },
        );
      }
    }
  }

  async rentRollJob() {
  this.logger.log('RentRollJob: Starting the Rent Roll Migration Process.');
  const migrations = await this.migrationsService.findByStatusAndFiletype('new', 'rentRoll');
  if (migrations.length === 0) {
    this.logger.log('RentRollJob: No new rentRoll migrations found.');
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
      if (!csvContent) throw new Error('Erro ao decodificar o arquivo. Encoding não suportado.');
      const records = parseCsv(csvContent);

      for (const [idx, row] of records.entries()) {
        total++;
        // Validação básica
        const validation = validateRentRollRow(row);
        if (!validation.success) {
          detalhes.push(`Linha ${idx + 2}: Erro de validação: ${validation.message}`);
          erros++;
          continue;
        }

        // Transação por linha
        const trx = await this.facilityService.getTransaction();
        try {
          // 1. Buscar unitId pelo facilityName + unitNumber
          const facility = await trx('facility').where({ name: row.facilityName }).first();
          if (!facility) {
            detalhes.push(`Linha ${idx + 2}: Facility não encontrada (${row.facilityName})`);
            ignoradas++;
            await trx.rollback();
            continue;
          }
          const unit = await trx('unit')
            .where({ facility_facilityid: facility.facilityid, number: row.unitNumber })
            .first();
          if (!unit) {
            detalhes.push(`Linha ${idx + 2}: Unit não encontrada (${row.unitNumber})`);
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
            // Supondo que tenant é o objeto retornado do banco
            
            console.log('Tenant ID:', tenant);
          // 3. Verificar duplicidade de rentalContract
          const existingContract = await this.rentalContractService.findExisting(
            unit.unitid,
            tenant,
            new Date(row.rentStartDate),
            trx,
          );
          if (existingContract) {
            detalhes.push(`Linha ${idx + 2}: Contrato duplicado ignorado.`);
            ignoradas++;
            await trx.rollback();
            continue;
          }

          // 4. Inserir rentalContract
          const rentalContractId = await this.rentalContractService.createRentalContract({
            unit_unitid: unit.unitid,
            tenant_tenantid: tenant,
            startdate: new Date(row.rentStartDate),
            enddate: new Date(row.rentEndDate),
            currentamountowed: parseFloat(row.currentRentOwed),
          }, trx);

          // 5. Inserir rentalInvoice
          await this.rentalInvoiceService.createRentalInvoice({
            rentalcontract_rentalcontractid: rentalContractId,
            invoiceduedate: new Date(row.currentRentOwedDueDate),
            invoiceamount: parseFloat(row.monthlyRent),
            invoicebalance: parseFloat(row.currentRentOwed),
          }, trx);

          await trx.commit();
          inseridas++;
          detalhes.push(`Linha ${idx + 2}: Processada com sucesso.`);
        } catch (err) {
          await trx.rollback();
          detalhes.push(`Linha ${idx + 2}: Erro: ${err.message || err}`);
          erros++;
        }
      }

      // Atualiza status para processed
      await this.migrationsService.updateFieldsById(migration.migrationscontrolid, {
        status: 'processed',
        endprocessing: new Date().toISOString(),
        msg: `Processadas: ${inseridas}, Ignoradas: ${ignoradas}, Erros: ${erros}`,
      });

      // Log detalhado
      this.logger.log(`RentRollJob: ${migration.filename} - Total: ${total}, Inseridas: ${inseridas}, Ignoradas: ${ignoradas}, Erros: ${erros}`);
      detalhes.forEach((msg) => this.logger.log(msg));
    } catch (err) {
      await this.migrationsService.updateFieldsById(migration.migrationscontrolid, {
        status: 'error',
        msg: String(err),
      });
      this.logger.error(`RentRollJob: Erro ao processar ${migration.filename}: ${err}`);
    }
  }
}
}
// Função de validação básica para cada linha do rentroll
function validateRentRollRow(row: any): { success: boolean; message?: string } {
  const required = [
    'facilityName', 'unitNumber', 'firstName', 'lastName', 'email',
    'rentStartDate', 'rentEndDate', 'monthlyRent', 'currentRentOwed', 'currentRentOwedDueDate'
  ];
  for (const key of required) {
    if (!row[key] || String(row[key]).trim() === '') {
      return { success: false, message: `Campo obrigatório ausente: ${key}` };
    }
  }
  // Datas válidas
  if (isNaN(Date.parse(row.rentStartDate))) return { success: false, message: 'rentStartDate inválido' };
  if (isNaN(Date.parse(row.rentEndDate))) return { success: false, message: 'rentEndDate inválido' };
  if (isNaN(Date.parse(row.currentRentOwedDueDate))) return { success: false, message: 'currentRentOwedDueDate inválido' };
  // Números positivos
  if (Number(row.monthlyRent) < 0) return { success: false, message: 'monthlyRent negativo' };
  if (Number(row.currentRentOwed) < 0) return { success: false, message: 'currentRentOwed negativo' };
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
    throw new Error('Erro ao ler o arquivo CSV: ' + error);
  }
}
