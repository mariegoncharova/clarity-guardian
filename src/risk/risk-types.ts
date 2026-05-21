import type {
  ResolvedRiskThresholdConfig,
  UnifiedTask
} from '../types';

export type RiskLevel = 'low' | 'medium' | 'high';

export type RiskCategory =
  | 'missing_context'
  | 'missing_expected_result'
  | 'missing_acceptance_criteria'
  | 'vague_wording'
  | 'untestable_result'
  | 'missing_edge_cases'
  | 'missing_links_or_examples'
  | 'qa_return_risk'
  | 'delivery_delay_risk'
  | 'communication_overhead';

export type RiskInputTask = {
  id?: string;
  title?: string;
  description: string;
  clarityScore?: number;
  source?: 'github' | 'jira' | 'yandex_tracker' | 'demo' | 'file';
  comments?: string[];
  statusHistory?: unknown[];
};

export interface RiskDetectedProblem {
  category: RiskCategory;
  message: string;
  riskPoints: number;
  evidence?: string[];
}

export interface RiskAnalysisResult {
  riskLevel: RiskLevel;
  riskScore: number;
  categories: RiskCategory[];
  detectedProblems: RiskDetectedProblem[];
  recommendations: string[];
  managerSummary: string;
  qaNotes: string[];
  rewrittenTaskSuggestion: string;
}

export interface RiskAnalysis extends RiskAnalysisResult {
  taskId: string;
  title: string;
  riskFactors: string[];
  recommendation: string;
  clarityScore?: number;
}

export interface NormalizedRiskTask {
  id?: string;
  title: string;
  description: string;
  fullText: string;
  clarityScore?: number;
  source?: string;
  comments: string[];
  statusHistory: unknown[];
  context: string;
  expectedResult: string;
  acceptanceCriteria: string[];
  edgeCases: string[];
  qaNotes: string[];
  workItemType?: UnifiedTask['workItemType'];
}

export interface AnalyzeRiskOptions {
  thresholds?: ResolvedRiskThresholdConfig;
}
