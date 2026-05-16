import { Test, TestingModule } from '@nestjs/testing';
import { OfficialStampsService } from './official-stamps.service';

describe('OfficialStampsService', () => {
  let service: OfficialStampsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OfficialStampsService],
    }).compile();

    service = module.get<OfficialStampsService>(OfficialStampsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
