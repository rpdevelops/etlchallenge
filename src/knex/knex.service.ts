import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import knex, { Knex } from 'knex';

@Injectable()
export class KnexService {
  public readonly db: Knex;

  constructor(private configService: ConfigService) {
    this.db = knex({
      client: 'pg',
      connection: this.configService.get<string>('DATABASE_CONNECTION_STRING'),
      pool: {
        min: 2,
        max: 5,
        idleTimeoutMillis: 10000, // free connections after 10s
        createTimeoutMillis: 30000,
        acquireTimeoutMillis: 30000,
      },
    });
  }

  onModuleDestroy() {
    this.db.destroy();
  }
}
