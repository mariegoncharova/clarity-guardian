export type RiskLevel = 'low' | 'medium' | 'high';

export interface RiskAnalysis {
  taskId: string;
  title: string;
  riskLevel: RiskLevel;
  riskScore: number;
  riskFactors: string[];
  recommendation: string;
}
