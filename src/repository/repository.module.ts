import { Module } from '@nestjs/common';
import { FacilityService } from './facility/facility.service';
import { UnitService } from './unit/unit.service';
import { MigrationsService } from './migrations/migrations.service';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [FacilityService, UnitService, MigrationsService],
  exports: [FacilityService, UnitService, MigrationsService],
})
export class RepositoryModule {}
