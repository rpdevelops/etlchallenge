import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KnexService } from 'src/knex/knex.service';

@Module({
  imports: [ConfigModule],
  providers: [KnexService],
  exports: [KnexService],
})
export class DatabaseModule {}
