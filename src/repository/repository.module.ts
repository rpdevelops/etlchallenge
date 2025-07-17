import { Module } from '@nestjs/common';
import { FacilityService } from './facility/facility.service';
import { UnitService } from './unit/unit.service';
import { MigrationsService } from './migrations/migrations.service';
import { DatabaseModule } from 'src/database/database.module';
import { TenantService } from './tenant/tenant.service';
import { RentalContractService } from './rentalcontract/rentalcontract.service';
import { RentalInvoiceService } from './rentalinvoice/rentalinvoice.service';

@Module({
  imports: [DatabaseModule],
  providers: [
    FacilityService,
    UnitService,
    MigrationsService,
    TenantService,
    RentalContractService,
    RentalInvoiceService,
  ],
  exports: [
    FacilityService,
    UnitService,
    MigrationsService,
    TenantService,
    RentalContractService,
    RentalInvoiceService,
  ],
})
export class RepositoryModule {}
