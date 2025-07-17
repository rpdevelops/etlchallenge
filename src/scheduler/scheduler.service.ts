import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MigrationsService } from '../repository/migrations/migrations.service';
import { SupabaseService } from '../supabase/supabase.service';
import { FacilityService } from '../repository/facility/facility.service';
import { UnitService } from '../repository/unit/unit.service';
import * as csvParse from 'csv-parse/sync';
import * as iconv from 'iconv-lite';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly migrationsService: MigrationsService,
    private readonly supabaseService: SupabaseService,
    private readonly facilityService: FacilityService,
    private readonly unitService: UnitService,
  ) {}

  @Cron('*/30 * * * * *')
  async handleJobUnit() {
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
}

// Função utilitária para parsear o unitSize
function parseUnitSize(unitSize: string): [number, number, number] {
  // Remove tudo que não é número, x ou ponto, e normaliza para minúsculo
  const cleaned = unitSize
    .replace(/[^0-9xX., ]+/g, '') // remove letras e símbolos, exceto x, ponto, vírgula e espaço
    .replace(/,/g, '.') // troca vírgula por ponto (caso decimal)
    .replace(/\s+/g, '') // remove todos os espaços
    .toLowerCase();

  // Procura padrão tipo 8x8x12 ou 8.5x10x12
  const match = cleaned.match(
    /(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)/,
  );
  if (!match) return [0, 0, 0];
  return [parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3])];
}

// Função utilitária para parsear o CSV
function parseCsv(content: string): Array<any> {
  try {
    return csvParse.parse(content, {
      columns: true,
      skip_empty_lines: true,
      delimiter: ';', // ajuste se necessário
      trim: true,
    });
  } catch (error) {
    throw new Error('Erro ao ler o arquivo CSV: ' + error);
  }
}
