import { Test, TestingModule } from '@nestjs/testing';
import { RentalinvoiceService } from './rentalinvoice.service';

describe('RentalinvoiceService', () => {
  let service: RentalinvoiceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RentalinvoiceService],
    }).compile();

    service = module.get<RentalinvoiceService>(RentalinvoiceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
