import { Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class FsmService {
  
  // Valid transitions for Vehicle Status Machine
  private readonly vehicleTransitions: Record<string, string[]> = {
    'SOURCING': ['IN_TRANSIT', 'SOLD'],
    'IN_TRANSIT': ['CUSTOMS', 'SOLD'],
    'CUSTOMS': ['REFURBISHMENT', 'SHOWROOM', 'SOLD'],
    'REFURBISHMENT': ['SHOWROOM', 'SOLD'],
    'SHOWROOM': ['RESERVED', 'SOLD'],
    'RESERVED': ['SHOWROOM', 'SOLD'],
    'SOLD': [] // Terminal state
  };

  // Valid transitions for Budget Workflow
  private readonly budgetTransitions: Record<string, string[]> = {
    'REQUESTED': ['APPROVED', 'REJECTED'],
    'APPROVED': ['DISBURSED', 'REJECTED'],
    'DISBURSED': ['SETTLED'],
    'SETTLED': [], // Terminal
    'REJECTED': ['REQUESTED'] // Re-submitting a rejected budget
  };

  /**
   * Programmatic validation of a vehicle state transition.
   * Throws BadRequestException on FSM policy violations.
   */
  validateVehicleTransition(oldStatus: string, newStatus: string): void {
    if (oldStatus === newStatus) return;

    const allowed = this.vehicleTransitions[oldStatus];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new BadRequestException(
        `FSM Policy Violation: Cannot transition vehicle from state [${oldStatus}] to [${newStatus}]. Allowed next states: ${allowed ? allowed.join(', ') : 'None'}`
      );
    }
  }

  /**
   * Programmatic validation of a budget state transition.
   * Throws BadRequestException on FSM policy violations.
   */
  validateBudgetTransition(oldStatus: string, newStatus: string): void {
    if (oldStatus === newStatus) return;

    const allowed = this.budgetTransitions[oldStatus];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new BadRequestException(
        `FSM Policy Violation: Cannot transition budget from state [${oldStatus}] to [${newStatus}]. Allowed next states: ${allowed ? allowed.join(', ') : 'None'}`
      );
    }
  }
}
