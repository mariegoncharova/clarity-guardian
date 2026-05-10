export type TaskType = 'issue' | 'pr';
export type WorkItemType = 'bug' | 'task' | 'story';
export type TemplateLanguage = 'ru' | 'en';
export type ConfigLanguage = TemplateLanguage | 'auto';
export type ClarityMode = 'strict' | 'non-strict';

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
  commentMarkdown: string;
  descriptionMarkdown: string;
  updatedBody: string;
  shouldUpdateDescription: boolean;
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
