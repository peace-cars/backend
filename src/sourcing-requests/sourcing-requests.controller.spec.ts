import { Test, TestingModule } from '@nestjs/testing';
import { SourcingRequestsController } from './sourcing-requests.controller';

describe('SourcingRequestsController', () => {
  let controller: SourcingRequestsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SourcingRequestsController],
    }).compile();

    controller = module.get<SourcingRequestsController>(SourcingRequestsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
