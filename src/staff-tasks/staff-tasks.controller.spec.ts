import { Test, TestingModule } from '@nestjs/testing';
import { StaffTasksController } from './staff-tasks.controller';

describe('StaffTasksController', () => {
  let controller: StaffTasksController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StaffTasksController],
    }).compile();

    controller = module.get<StaffTasksController>(StaffTasksController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
