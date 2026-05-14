import { isReturnedFromTesting } from '../retro-analyzer';
import {
  EXTERNAL_DEPENDENCY_KEYWORDS,
  LARGE_SCOPE_KEYWORDS,
  RISKY_DOMAIN_KEYWORDS,
  VAGUE_PHRASES,
  findKeywords,
  getTaskClarityScore,
  getTaskId,
  getTaskText,
  hasAcceptanceCriteria,
  hasContext,
  hasDependencyInfo,
  hasExpectedResult
} from '../task-signals';

import type {
  UnifiedTask
} from '../types';

import type {
  RiskAnalysis,
  RiskLevel
} from './models';

function capScore(score: number): number {
  return Math.min(100, Math.max(0, score));
}

function toRiskLevel(score: number): RiskLevel {
  if (score <= 30) {
    return 'low';
  }

  if (score <= 60) {
    return 'medium';
  }

  return 'high';
}

function buildRecommendation(factors: string[]): string {
  if (factors.length === 0) {
    return 'Риск низкий: задача выглядит достаточно понятной для планирования.';
  }

  const actions: string[] = [];

  if (factors.some((factor) => /Clarity Score|контекст|ожидаемый|критер/i.test(factor))) {
    actions.push('уточнить требования и добавить недостающие блоки');
  }

  if (factors.some((factor) => /оплат|плат|возврат|безопас|персональные|релиз|prod|production/i.test(factor))) {
    actions.push('проверить влияние на рискованный домен');
  }

  if (factors.some((factor) => /зависим|блокер|ответ/i.test(factor))) {
    actions.push('согласовать внешние зависимости до старта');
  }

  if (factors.some((factor) => /scope|круп|сценари|сервис|рефакторинг|миграц/i.test(factor))) {
    actions.push('разбить задачу на меньшие части');
  }

  if (actions.length === 0) {
    actions.push('обсудить факторы риска на grooming');
  }

  return `${actions[0][0].toUpperCase()}${actions[0].slice(1)}${actions.length > 1 ? `, ${actions.slice(1).join(', ')}` : ''}.`;
}

/** Рассчитывает риск задачи по ясности, содержанию, домену, зависимостям и истории возвратов. */
export function analyzeTaskRisk(task: UnifiedTask): RiskAnalysis {
  const clarityScore = getTaskClarityScore(task);
  const text = getTaskText(task);
  const factors: string[] = [];
  let riskScore = 0;

  if (clarityScore < 60) {
    riskScore += 30;
    factors.push('Низкий Clarity Score');
  } else if (clarityScore < 80) {
    riskScore += 15;
    factors.push('Средний Clarity Score');
  }

  if (!hasAcceptanceCriteria(task)) {
    riskScore += 20;
    factors.push('Нет критериев приёмки');
  }

  if (!hasExpectedResult(task)) {
    riskScore += 15;
    factors.push('Нет ожидаемого результата');
  }

  if (!hasContext(task)) {
    riskScore += 15;
    factors.push('Нет контекста');
  }

  const vagueMatches = findKeywords(text, VAGUE_PHRASES);
  if (vagueMatches.length > 0) {
    riskScore += Math.min(30, vagueMatches.length * 10);
    factors.push(`Мутная формулировка: ${vagueMatches.slice(0, 3).join(', ')}`);
  }

  const domainMatches = findKeywords(text, RISKY_DOMAIN_KEYWORDS);
  if (domainMatches.length > 0) {
    riskScore += 15;
    factors.push(`Рискованный домен: ${domainMatches[0]}`);
  }

  const dependencyMatches = findKeywords(text, EXTERNAL_DEPENDENCY_KEYWORDS);
  if (dependencyMatches.length > 0) {
    riskScore += 20;
    factors.push('Есть внешняя зависимость');

    if (!hasDependencyInfo(task)) {
      riskScore += 15;
      factors.push('Зависимость не описана отдельным полем');
    }
  }

  const scopeMatches = findKeywords(text, LARGE_SCOPE_KEYWORDS);
  if (scopeMatches.length > 0) {
    riskScore += 20;
    factors.push(`Большой scope: ${scopeMatches[0]}`);
  }

  if (isReturnedFromTesting(task)) {
    riskScore += 15;
    factors.push('Задача возвращалась с тестирования');
  }

  if (clarityScore < 60) {
    riskScore = Math.max(riskScore, 61);
  }

  const cappedScore = capScore(riskScore);

  return {
    taskId: getTaskId(task),
    title: task.title,
    riskLevel: toRiskLevel(cappedScore),
    riskScore: cappedScore,
    riskFactors: factors,
    recommendation: buildRecommendation(factors)
  };
}

export function analyzeRisks(tasks: UnifiedTask[]): RiskAnalysis[] {
  return tasks.map(analyzeTaskRisk);
}
