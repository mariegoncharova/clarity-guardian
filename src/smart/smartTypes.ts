import type { UnifiedTask } from '../types';

export type SmartCriterionKey =
  | 'specific'
  | 'measurable'
  | 'achievable'
  | 'relevant'
  | 'timeBound';

export type SmartCriterionStatus = 'passed' | 'warning' | 'failed';
export type SmartAnalysisStatus = 'strong' | 'needs_improvement' | 'weak';

export interface SmartCriterionResult {
  key: SmartCriterionKey;
  title: string;
  score: number;
  status: SmartCriterionStatus;
  foundSignals: string[];
  missingSignals: string[];
  recommendations: string[];
}

export interface SmartAnalysisResult {
  totalScore: number;
  status: SmartAnalysisStatus;
  criteria: SmartCriterionResult[];
  summary: string;
  recommendations: string[];
}

export type SmartTaskInput = string | UnifiedTask;

export interface SmartSignalPattern {
  label: string;
  pattern: RegExp;
}

export interface SmartVaguePhrase {
  phrase: string;
  pattern: RegExp;
  mitigatedByConcreteResult?: boolean;
  mitigatedByTimeContext?: boolean;
}
