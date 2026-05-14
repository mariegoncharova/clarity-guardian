import {
  checkDefinitionOfDone
} from './dod';
import {
  checkDefinitionOfReady
} from './dor';

import type {
  UnifiedTask
} from '../types';

import type {
  ReadinessAnalytics
} from './models';

export function analyzeReadiness(tasks: UnifiedTask[]): ReadinessAnalytics[] {
  return tasks.map((task) => ({
    taskId: task.key || task.id,
    title: task.title,
    dor: checkDefinitionOfReady(task),
    dod: checkDefinitionOfDone(task)
  }));
}
