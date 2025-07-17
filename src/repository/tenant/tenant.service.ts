import { Injectable } from '@nestjs/common';
import { KnexService } from '../../knex/knex.service';

@Injectable()
export class TenantService {
  constructor(private readonly knexService: KnexService) {}

  async upsertTenant(
    data: { firstname: string; lastname: string; email: string; phone: string },
    trx?,
  ) {
    let query = this.knexService
      .db('tenant')
      .where({
        firstname: data.firstname,
        lastname: data.lastname,
        email: data.email,
      });
    if (trx) query = query.transacting(trx);
    let tenant = await query.first();
    if (!tenant) {
      const [tenantid] = await this.knexService
        .db('tenant')
        .insert(data)
        .transacting(trx)
        .returning('tenantid');
      tenant = { tenantid, ...data };
      return tenantid.tenantid;
    }
    return tenant.tenantid;
  }
}
