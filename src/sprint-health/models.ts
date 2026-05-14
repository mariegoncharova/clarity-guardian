import type {
  DoneResult,
  ReadinessResult
} from '../readiness/models';
import type {
  RiskAnalysis,
  RiskLevel
} from '../risk/models';

export type SprintHealthStatus = 'green' | 'yellow' | 'red';

export interface SprintHealthTaskAnalytics {
  taskId: string;
  title: string;
  sprint?: string;
  assignee?: string;
  clarityScore: number;
  risk: RiskAnalysis;
  dor: ReadinessResult;
  dod: DoneResult;
  isReopened: boolean;
  isStuck: boolean;
}

export interface SprintHealthReport {
  sprint: string;
  sprintHealthStatus: SprintHealthStatus;
  summary: {
    totalTasks: number;
    averageClarityScore: number;
    averageRiskScore: number;
    readyTasksCount: number;
    notReadyTasksCount: number;
    readyTasksPercent: number;
    highRiskTasksCount: number;
    mediumRiskTasksCount: number;
    lowRiskTasksCount: number;
    tasksWithoutAcceptanceCriteria: number;
    tasksWithoutExpectedResult: number;
    tasksWithExternalDependencies: number;
    largeScopeTasks: number;
    reopenedTasks: number;
    stuckTasks: number;
  };
  riskDistribution: Record<RiskLevel, number>;
  readiness: {
    readyTasks: number;
    notReadyTasks: number;
    readyPercent: number;
  };
  highRiskTasks: SprintHealthTaskAnalytics[];
  notReadyTasks: SprintHealthTaskAnalytics[];
  mainRiskFactors: Array<{
    name: string;
    count: number;
  }>;
  mainProblems: string[];
  recommendations: string[];
  managerSummary: string;
  taskLevelAnalytics: SprintHealthTaskAnalytics[];
}
