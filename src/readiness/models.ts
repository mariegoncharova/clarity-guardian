export interface ReadinessResult {
  taskId: string;
  title: string;
  dorPassed: boolean;
  dorScore: number;
  passedChecks: string[];
  failedChecks: string[];
  recommendation: string;
}

export interface DoneResult {
  taskId: string;
  title: string;
  dodPassed: boolean;
  dodScore: number;
  passedChecks: string[];
  failedChecks: string[];
  recommendation: string;
}

export interface ReadinessAnalytics {
  taskId: string;
  title: string;
  dor: ReadinessResult;
  dod: DoneResult;
}
