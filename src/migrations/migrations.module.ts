import { Module } from '@nestjs/common';
import { MigrationsService } from './migrations.service';
import { MigrationsController } from './migrations.controller';

@Module({
  controllers: [MigrationsController],
  providers: [MigrationsService],
})
export class MigrationsModule {}
