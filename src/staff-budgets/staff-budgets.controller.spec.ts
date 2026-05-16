import { Test, TestingModule } from '@nestjs/testing';
import { StaffBudgetsController } from './staff-budgets.controller';

describe('StaffBudgetsController', () => {
  let controller: StaffBudgetsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StaffBudgetsController],
    }).compile();

    controller = module.get<StaffBudgetsController>(StaffBudgetsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
