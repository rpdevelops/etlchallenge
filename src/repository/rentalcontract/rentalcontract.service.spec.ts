import { Test, TestingModule } from '@nestjs/testing';
import { RentalcontractService } from './rentalcontract.service';

describe('RentalcontractService', () => {
  let service: RentalcontractService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RentalcontractService],
    }).compile();

    service = module.get<RentalcontractService>(RentalcontractService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
