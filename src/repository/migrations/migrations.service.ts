import { Injectable } from '@nestjs/common';
import { KnexService } from '../../knex/knex.service';

@Injectable()
export class MigrationsService {
  constructor(private readonly knexService: KnexService) {}

  async findAllFromDb() {
    return this.knexService
      .db('railway')
      .table('migrationscontrol')
      .select('*');
  }

  async updateFieldsById(
    id: number,
    fields: {
      status?: string;
      startprocessing?: string | null;
      endprocessing?: string | null;
      msg?: string | null;
    },
  ) {
    // Remove campos undefined para não sobrescrever com undefined
    const updateData = Object.fromEntries(
      Object.entries(fields).filter(([, v]) => v !== undefined),
    );
    return this.knexService
      .db('migrationscontrol')
      .where('migrationscontrolid', id)
      .update(updateData);
  }

  async findByStatusAndFiletype(status?: string, filetype?: string) {
    let query = this.knexService.db('migrationscontrol').select('*');
    if (status) {
      query = query.where('status', status);
    }
    if (filetype) {
      query = query.where('filetype', filetype);
    }
    return query;
  }

  async createMigrationControl(data: { filename: string; filetype: string }) {
    await this.knexService.db('migrationscontrol').insert({
      filename: data.filename,
      filetype: data.filetype,
    });
  }
}
