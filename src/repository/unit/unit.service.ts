import { Injectable } from '@nestjs/common';
import { KnexService } from '../../knex/knex.service';

@Injectable()
export class UnitService {
  constructor(private readonly knexService: KnexService) {}

  async createUnit(data: {
    facility_facilityid: number;
    number: string;
    unitwidth: number;
    unitlength: number;
    unitheight: number;
    unittype: string;
  }) {
    // Verifica se já existe unit com mesmo facility_facilityid e number
    const exists = await this.knexService
      .db('unit')
      .where({
        facility_facilityid: data.facility_facilityid,
        number: data.number,
      })
      .first();

    if (!exists) {
      await this.knexService.db('unit').insert(data);
    }
    // Se já existe, não faz nada (ou pode atualizar, se desejar)
  }
}
