import { Test, TestingModule } from '@nestjs/testing';
import { StaffTasksService } from './staff-tasks.service';

describe('StaffTasksService', () => {
  let service: StaffTasksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StaffTasksService],
    }).compile();

    service = module.get<StaffTasksService>(StaffTasksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
