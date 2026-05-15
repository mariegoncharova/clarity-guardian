export type ToneCategory =
  | 'vague_wording'
  | 'blaming_tone'
  | 'unclear_urgency'
  | 'passive_aggressive'
  | 'missing_expected_result'
  | 'missing_context'
  | 'too_informal'
  | 'constructive';

export type ToneRiskLevel = 'low' | 'medium' | 'high';

export interface ToneProblematicPhrase {
  phrase: string;
  category: ToneCategory;
  explanation: string;
}

export interface ToneAnalysisResult {
  tone: string;
  riskLevel: ToneRiskLevel;
  categories: ToneCategory[];
  problematicPhrases: ToneProblematicPhrase[];
  recommendation: string;
  rewrittenText?: string;
}
