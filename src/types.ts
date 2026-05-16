import type { ToneAnalysisResult } from './types/toneOfVoice';

export type TaskType = 'issue' | 'pr';
export type WorkItemType = 'bug' | 'task' | 'story' | 'research' | 'tech_debt';
export type TemplateLanguage = 'ru' | 'en';
export type ConfigLanguage = TemplateLanguage | 'auto';
export type ClarityMode = 'strict' | 'non-strict';
export type TaskSource = 'github' | 'jira' | 'yandex-tracker' | 'demo' | 'file';
export type TaskPeriod = 'before' | 'after';

export type RemarkLevel = 'error' | 'warning';

export interface TaskPayload {
  type?: TaskType;
  number?: number;
  title?: string;
  body?: string;
  labels?: string[];
  isDraft?: boolean;
  action?: string;
  repository?: string;
  htmlUrl?: string;
  sourceRef?: string;
  baseRef?: string;
  workItemType?: WorkItemType;
  language?: TemplateLanguage;
  jiraIssueKey?: string;
}

export interface NormalizedTask {
  type: TaskType;
  title: string;
  body: string;
  labels: string[];
  workItemType: WorkItemType;
  language: TemplateLanguage;
}

export interface TaskMetrics {
  cycleTimeHours?: number;
  qaReturns?: number;
  commentsCount?: number;
  descriptionChanges?: number;
}

export interface StatusHistoryEntry {
  status: string;
  enteredAt: string;
  leftAt?: string;
}

export interface UnifiedTask {
  id: string;
  source: TaskSource;
  title: string;
  body: string;
  type?: TaskType;
  key?: string;
  url?: string;
  projectKey?: string;
  queue?: string;
  status?: string;
  assignee?: string;
  author?: string;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string;
  clarityScore?: number;
  statusHistory?: StatusHistoryEntry[];
  comments?: string[];
  labels?: string[];
  workItemType?: WorkItemType;
  context?: string;
  expectedResult?: string;
  acceptanceCriteria?: string[];
  dependencies?: string[];
  priority?: string;
  sprint?: string;
  tags?: string[];
  components?: string[];
  period?: TaskPeriod;
  metrics?: TaskMetrics;
}

export interface TaskProvider {
  listTasks(): Promise<UnifiedTask[]>;
}

export interface Remark {
  level: RemarkLevel;
  code: string;
  message: string;
  section?: string;
  phrase?: string;
  workItemType?: WorkItemType;
}

export interface AnalysisResult {
  hasErrors: boolean;
  hasWarnings: boolean;
  mode: ClarityMode;
  language: TemplateLanguage;
  workItemType: WorkItemType;
  remarks: Remark[];
  clarityScore: {
    score: number;
    riskLevel: 'low' | 'medium' | 'high';
    communicationRisks: Array<{
      type: string;
      title: string;
      message: string;
      recommendation: string;
    }>;
  };
  toneOfVoice: ToneAnalysisResult;
  clarityFixSuggestions: ClarityFixSuggestions;
  managerRecommendations: string[];
  commentMarkdown: string;
  descriptionMarkdown: string;
  updatedBody: string;
  shouldUpdateDescription: boolean;
}

export interface ClarityFixSuggestions {
  questions: string[];
  draftMarkdown: string;
  pmFriendlyRewrite: string;
  nextActions: string[];
}

export interface ChecklistResult {
  source: 'openai' | 'fallback';
  language: TemplateLanguage;
  workItemType: WorkItemType;
  checklistMarkdown: string;
  commentMarkdown: string;
}

export interface StopPhraseRuleConfig {
  phrase: string;
  level?: RemarkLevel;
  code?: string;
  message?: string;
  languages?: TemplateLanguage[];
  workItemTypes?: WorkItemType[];
}

export interface SectionRuleConfig {
  section: string;
  aliases?: string[];
  level?: RemarkLevel;
  code?: string;
  message?: string;
  minNonWhitespaceChars?: number;
  languages?: TemplateLanguage[];
  workItemTypes?: WorkItemType[];
}

export interface RuleSetConfig {
  requiredSections?: SectionRuleConfig[];
  stopPhrases?: StopPhraseRuleConfig[];
}

export interface ClarityGuardianConfig {
  language?: ConfigLanguage;
  mode?: ClarityMode;
  strict?: boolean;
  updateDescription?: boolean;
  rules?: Partial<Record<'common' | WorkItemType, RuleSetConfig>>;
  stopPhrases?: StopPhraseRuleConfig[];
}

export interface ResolvedConfig {
  language: ConfigLanguage;
  mode: ClarityMode;
  updateDescription: boolean;
  rules: Record<'common' | WorkItemType, RuleSetConfig>;
  stopPhrases: StopPhraseRuleConfig[];
}

export interface OpenAITextContentItem {
  text?: string;
}

export interface OpenAIOutputItem {
  content?: OpenAITextContentItem[];
}

export interface OpenAIResponseBody {
  output_text?: string;
  output?: OpenAIOutputItem[];
}

export interface TaskAnalysisRecord {
  task: UnifiedTask;
  analyzedAt: string;
  score: number;
  riskLevel: 'low' | 'medium' | 'high';
  problemCodes: string[];
  recommendations: string[];
  analysis: AnalysisResult;
}

export interface ClarityScoreHistoryEntry {
  taskId: string;
  taskKey?: string;
  source: TaskSource;
  projectKey?: string;
  analyzedAt: string;
  score: number;
  riskLevel: 'low' | 'medium' | 'high';
  problemCodes: string[];
  recommendations: string[];
}

export interface DistributionItem {
  name: string;
  count: number;
}

export interface DashboardTaskSummary {
  id: string;
  key?: string;
  title: string;
  source: TaskSource;
  status?: string;
  assignee?: string;
  author?: string;
  score: number;
  riskLevel: 'low' | 'medium' | 'high';
  problemCodes: string[];
  recommendations: string[];
}

export interface ClarityDashboard {
  generatedAt: string;
  totalTasks: number;
  averageScore: number;
  quality: {
    good: number;
    medium: number;
    poor: number;
  };
  topProblems: DistributionItem[];
  statusDistribution: DistributionItem[];
  authorDistribution: DistributionItem[];
  assigneeDistribution: DistributionItem[];
  lowestScoreTasks: DashboardTaskSummary[];
  trendByDay: DistributionItem[];
  trendByWeek: DistributionItem[];
}

export interface PeriodComparison {
  before: {
    totalTasks: number;
    averageScore: number;
    lowQualityTasks: number;
    missingAcceptanceCriteria: number;
    missingContext: number;
    qaReturns: number;
  };
  after: {
    totalTasks: number;
    averageScore: number;
    lowQualityTasks: number;
    missingAcceptanceCriteria: number;
    missingContext: number;
    qaReturns: number;
  };
  delta: {
    averageScore: number;
    averageScorePercent: number;
    lowQualityTasks: number;
    missingAcceptanceCriteria: number;
    missingContext: number;
    qaReturns: number;
  };
}

export interface ResearchReportData {
  totalTasks: number;
  highClarityAverageCycleHours: number | null;
  lowClarityAverageCycleHours: number | null;
  highClarityAverageQaReturns: number | null;
  lowClarityAverageQaReturns: number | null;
  highClarityAverageComments: number | null;
  lowClarityAverageComments: number | null;
  highClarityAverageDescriptionChanges: number | null;
  lowClarityAverageDescriptionChanges: number | null;
  notes: string[];
}
