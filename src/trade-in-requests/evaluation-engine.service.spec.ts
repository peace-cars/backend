import { EvaluationEngineService } from './evaluation-engine.service';
import { InspectionScores, VehicleDetails } from '../common/types/trade-in.types';

describe('EvaluationEngineService', () => {
  let service: EvaluationEngineService;

  beforeEach(() => {
    service = new EvaluationEngineService();
  });

  it('should calculate risk correctly for standard inspection', () => {
    const scores: InspectionScores = {
      mechanical: 80,
      exterior: 90,
      interior: 80
    };

    const vehicle: VehicleDetails = {
      isEV: false,
      mileage: 50000
    };

    const result = service.evaluateRisk(scores, vehicle);
    
    expect(result.averageScore).toBeCloseTo(83.33, 1);
    expect(result.riskLevel).toBe('LOW');
    expect(result.flags.length).toBe(0);
  });

  it('should calculate risk correctly for EV inspection including battery', () => {
    const scores: InspectionScores = {
      mechanical: 80,
      exterior: 90,
      interior: 80,
      battery_health: 90
    };

    const vehicle: VehicleDetails = {
      isEV: true,
      mileage: 50000
    };

    const result = service.evaluateRisk(scores, vehicle);
    
    expect(result.riskLevel).toBe('LOW');
  });

  it('should flag and fail if mechanical score is less than 50', () => {
    const scores: InspectionScores = {
      mechanical: 40,
      exterior: 90,
      interior: 80
    };

    const result = service.evaluateRisk(scores);
    expect(result.riskLevel).toBe('MEDIUM');
    expect(result.flags).toContain('POWERTRAIN_WARNING');
  });

  it('should flag and fail with critical risk if mechanical score is less than 30', () => {
    const scores: InspectionScores = {
      mechanical: 20,
      exterior: 90,
      interior: 80
    };

    const result = service.evaluateRisk(scores);
    expect(result.riskLevel).toBe('HIGH');
    expect(result.flags).toContain('CRITICAL_MECHANICAL_FAILURE');
  });

  it('should flag EV battery degradation if health is below 70', () => {
    const scores: InspectionScores = {
      mechanical: 80,
      exterior: 80,
      interior: 80,
      battery_health: 60
    };

    const vehicle: VehicleDetails = {
      isEV: true,
      mileage: 50000
    };

    const result = service.evaluateRisk(scores, vehicle);
    expect(result.riskLevel).toBe('HIGH');
    expect(result.flags).toContain('BATTERY_DEGRADATION_CRITICAL');
  });

  it('should flag high mileage if mileage exceeds 150000', () => {
    const scores: InspectionScores = {
      mechanical: 80,
      exterior: 80,
      interior: 80
    };

    const vehicle: VehicleDetails = {
      isEV: false,
      mileage: 160000
    };

    const result = service.evaluateRisk(scores, vehicle);
    expect(result.flags).toContain('HIGH_MILEAGE_ALERT');
  });
});
