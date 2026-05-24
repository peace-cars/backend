import { Injectable } from '@nestjs/common';

@Injectable()
export class EvaluationEngineService {
  evaluateRisk(mechanical_score: number, exterior_score: number, interior_score: number): string | null {
    const averageScore = (mechanical_score + exterior_score + interior_score) / 3;
    if (averageScore < 40) {
      return 'HIGH_RISK_REJECTION_RECOMMENDED';
    } else if (mechanical_score < 50) {
      return 'POWERTRAIN_WARNING';
    }
    return null;
  }
}
