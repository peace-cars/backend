import { FsmService } from './fsm.service';
import { BadRequestException } from '@nestjs/common';

describe('FsmService', () => {
  let fsmService: FsmService;

  beforeEach(() => {
    fsmService = new FsmService();
  });

  describe('Vehicle State Transitions', () => {
    it('should allow valid transition from SOURCING to IN_TRANSIT', () => {
      expect(() => {
        fsmService.validateVehicleTransition('SOURCING', 'IN_TRANSIT');
      }).not.toThrow();
    });

    it('should prevent invalid transition from SOURCING to RESERVED', () => {
      expect(() => {
        fsmService.validateVehicleTransition('SOURCING', 'RESERVED');
      }).toThrow(BadRequestException);
    });

    it('should allow same-state transition', () => {
      expect(() => {
        fsmService.validateVehicleTransition('SOURCING', 'SOURCING');
      }).not.toThrow();
    });

    it('should allow transition from RESERVED to SHOWROOM (cancel reservation)', () => {
      expect(() => {
        fsmService.validateVehicleTransition('RESERVED', 'SHOWROOM');
      }).not.toThrow();
    });
  });

  describe('Budget Workflow Transitions', () => {
    it('should allow valid transition from REQUESTED to APPROVED', () => {
      expect(() => {
        fsmService.validateBudgetTransition('REQUESTED', 'APPROVED');
      }).not.toThrow();
    });

    it('should prevent invalid transition from REQUESTED to DISBURSED', () => {
      expect(() => {
        fsmService.validateBudgetTransition('REQUESTED', 'DISBURSED');
      }).toThrow(BadRequestException);
    });

    it('should allow same-state transition', () => {
      expect(() => {
        fsmService.validateBudgetTransition('APPROVED', 'APPROVED');
      }).not.toThrow();
    });
  });
});
