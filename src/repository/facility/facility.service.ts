import { Injectable } from '@nestjs/common';
import { KnexService } from '../../knex/knex.service';

@Injectable()
export class FacilityService {
  constructor(private readonly knexService: KnexService) {}

  getTransaction() {
    return this.knexService.db.transaction();
  }

  async createIfNotExists(name: string, trx?) {
    let query = this.knexService.db('facility').where({ name });
    if (trx) query = query.transacting(trx);
    let facility = await query.first();
    if (!facility) {
      const [id] = await this.knexService
        .db('facility')
        .insert({ name })
        .transacting(trx)
        .returning('facilityid');
      facility = { facilityid: id, name };
      return id.facilityid;
    }
    return facility.facilityid;
  }

  async getAllFacilities() {
    return this.knexService.db('facility').select('*').orderBy('facilityid', 'desc');
  }
}
