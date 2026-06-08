import { Injectable } from '@nestjs/common';
import { InspectionScores, RiskAssessment } from '../common/types/trade-in.types';
import { VehicleDetails } from '../common/types/vehicle.types';

@Injectable()
export class EvaluationEngineService {
  evaluateRisk(scores: InspectionScores, vehicleDetails?: VehicleDetails): RiskAssessment {
    const risks: string[] = [];
    const avg = (scores.mechanical + scores.exterior + scores.interior) / 3;
    
    // Mechanical red flags
    if (scores.mechanical < 30) risks.push('CRITICAL_MECHANICAL_FAILURE');
    else if (scores.mechanical < 50) risks.push('POWERTRAIN_WARNING');
    
    // EV-specific checks
    if (vehicleDetails?.isEV) {
      const soh = scores.battery_health || 0;
      if (soh < 70) risks.push('BATTERY_DEGRADATION_CRITICAL');
      else if (soh < 80) risks.push('BATTERY_DEGRADATION_WARNING');
    }
    
    // Age/mileage depreciation
    if (vehicleDetails?.mileage && vehicleDetails.mileage > 150000) {
      risks.push('HIGH_MILEAGE_ALERT');
    }
    
    // Overall assessment
    const riskLevel = risks.length === 0 ? 'LOW' : 
                      risks.some(r => r.includes('CRITICAL')) ? 'HIGH' : 'MEDIUM';
    
    return { riskLevel, flags: risks, averageScore: avg };
  }
}
