import { Injectable } from '@nestjs/common';
import { KnexService } from '../../knex/knex.service';

@Injectable()
export class RentalInvoiceService {
  constructor(private readonly knexService: KnexService) {}

  async createRentalInvoice(data: {
    rentalcontract_rentalcontractid: number;
    invoiceduedate: Date;
    invoiceamount: number;
    invoicebalance: number;
  }, trx?) {
    await this.knexService.db('rentalinvoice')
      .insert(data)
      .transacting(trx);
  }
}
