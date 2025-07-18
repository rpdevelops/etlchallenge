import { Injectable } from '@nestjs/common';
import { KnexService } from '../../knex/knex.service';

@Injectable()
export class RentalContractService {
  constructor(private readonly knexService: KnexService) {}

  async findExisting(unitId: number, tenantId: number, startdate: Date, trx?) {
    let query = this.knexService.db('rentalcontract')
      .where({ unit_unitid: unitId, tenant_tenantid: tenantId, startdate });
    if (trx) query = query.transacting(trx);
    return query.first();
  }

  async createRentalContract(data: {
    unit_unitid: number;
    tenant_tenantid: number;
    startdate: Date;
    enddate: Date | null;
    currentamountowed: number;
  }, trx?) {
    const [rentalContractId] = await this.knexService.db('rentalcontract')
      .insert(data)
      .transacting(trx)
      .returning('rentalcontractid');
    return rentalContractId.rentalcontractid;
  }

  async getAllRentalContracts() {
    return this.knexService.db('rentalcontract').select('*').orderBy('rentalcontractid', 'desc');
  }
}
