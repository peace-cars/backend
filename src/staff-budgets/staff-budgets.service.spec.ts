import { Test, TestingModule } from '@nestjs/testing';
import { StaffBudgetsService } from './staff-budgets.service';

describe('StaffBudgetsService', () => {
  let service: StaffBudgetsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StaffBudgetsService],
    }).compile();

    service = module.get<StaffBudgetsService>(StaffBudgetsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
