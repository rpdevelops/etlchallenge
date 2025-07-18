import { Injectable } from '@nestjs/common';
import { KnexService } from '../../knex/knex.service';

@Injectable()
export class UnitService {
  constructor(private readonly knexService: KnexService) {}

  async createUnit(
    data: {
      facility_facilityid: number;
      number: string;
      unitwidth: number;
      unitlength: number;
      unitheight: number;
      unittype: string;
    },
    trx?
  ) {
    let query = this.knexService
      .db('unit')
      .where({
        facility_facilityid: data.facility_facilityid,
        number: data.number,
      });
    if (trx) query = query.transacting(trx);
    const exists = await query.first();

    if (!exists) {
      let insertQuery = this.knexService.db('unit').insert(data);
      if (trx) insertQuery = insertQuery.transacting(trx);
      await insertQuery;
    }
  }

  async updateUnit(
    facility_facilityid: number,
    number: string,
    data: {
      unitwidth?: number;
      unitlength?: number;
      unitheight?: number;
      unittype?: string;
      monthlyrent?: number;
    },
    trx?
  ) {
    let query = this.knexService
      .db('unit')
      .where({
        facility_facilityid,
        number,
      });
    if (trx) query = query.transacting(trx);
    await query.update(data);
  }

  async getUnitByFacilityAndNumber(
    facility_facilityid: number,
    number: string,
    trx?
  ) {
    let query = this.knexService
      .db('unit')
      .where({
        facility_facilityid,
        number,
      });
    if (trx) query = query.transacting(trx);
    return query.first();
  }

  async getAllUnits() {
    return this.knexService.db('unit').select('*').orderBy('unitid', 'desc');
  }
}
