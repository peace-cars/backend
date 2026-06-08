export interface InspectionScores {
  mechanical: number;
  exterior: number;
  interior: number;
  battery_health?: number;
}

export interface RiskAssessment {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  flags: string[];
  averageScore: number;
}

export type TradeInStatus = 'NEW_LEAD' | 'INSPECTION_PENDING' | 'MANAGER_REVIEW' | 'ESCALATED_TO_GM' | 'OFFER_MADE' | 'ACCEPTED' | 'REJECTED';
