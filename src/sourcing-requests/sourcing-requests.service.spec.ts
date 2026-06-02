import { Test, TestingModule } from '@nestjs/testing';
import { SourcingRequestsService } from './sourcing-requests.service';

describe('SourcingRequestsService', () => {
  let service: SourcingRequestsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SourcingRequestsService],
    }).compile();

    service = module.get<SourcingRequestsService>(SourcingRequestsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
