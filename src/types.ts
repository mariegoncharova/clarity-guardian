export type TaskType = 'issue' | 'pr';

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
}

export interface NormalizedTask {
  type: TaskType;
  title: string;
  body: string;
}

export interface Remark {
  level: RemarkLevel;
  code: string;
  message: string;
  section?: string;
  phrase?: string;
}

export interface AnalysisResult {
  hasErrors: boolean;
  hasWarnings: boolean;
  remarks: Remark[];
  commentMarkdown: string;
}

export interface ChecklistResult {
  source: 'openai' | 'fallback';
  checklistMarkdown: string;
  commentMarkdown: string;
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
