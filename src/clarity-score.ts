import type { Remark } from './types';

export type ClarityRiskLevel = 'low' | 'medium' | 'high';

export type CommunicationRiskType =
  | 'implicit_context'
  | 'ambiguous_result'
  | 'unverifiable_acceptance'
  | 'hidden_agreement'
  | 'missing_user_scenario'
  | 'qa_uncertainty'
  | 'implementation_without_goal';

export interface CommunicationRisk {
  type: CommunicationRiskType;
  title: string;
  message: string;
  roleImpact: {
    manager?: string;
    developer?: string;
    qa?: string;
  };
  recommendation: string;
}

export interface ClarityScoreResult {
  score: number;
  riskLevel: ClarityRiskLevel;
  communicationRisks: CommunicationRisk[];
}

function hasAny(text: string, markers: string[]): boolean {
  const normalized = text.toLowerCase();

  return markers.some((marker) => normalized.includes(marker.toLowerCase()));
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}

function getRiskLevel(score: number): ClarityRiskLevel {
  if (score >= 80) {
    return 'low';
  }

  if (score >= 50) {
    return 'medium';
  }

  return 'high';
}

export function calculateClarityScore(params: {
  title: string;
  body: string;
  remarks: Remark[];
}): ClarityScoreResult {
  const { body, remarks } = params;

  let score = 100;
  const communicationRisks: CommunicationRisk[] = [];

  const errorsCount = remarks.filter((remark) => remark.level === 'error').length;
  const warningsCount = remarks.filter((remark) => remark.level === 'warning').length;

  score -= errorsCount * 20;
  score -= warningsCount * 7;

  const hasContextSection = body.includes('## Контекст') || body.includes('## Context');
  const hasExpectedResultSection =
    body.includes('## Ожидаемый результат') || body.includes('## Expected result');
  const hasAcceptanceCriteriaSection =
    body.includes('## Критерии приёмки') || body.includes('## Acceptance criteria');

  if (!hasContextSection) {
    score -= 20;

    communicationRisks.push({
      type: 'implicit_context',
      title: 'Неявный контекст',
      message: 'В задаче недостаточно объяснено, зачем она нужна и какую проблему решает.',
      roleImpact: {
        manager: 'Ожидание может остаться незафиксированным.',
        developer: 'Придётся додумывать цель изменения.',
        qa: 'Будет сложнее понять, какой пользовательский сценарий проверять.'
      },
      recommendation: 'Добавить раздел с причиной задачи, пользовательской проблемой и ссылками на источники контекста.'
    });
  }

  if (!hasExpectedResultSection) {
    score -= 20;

    communicationRisks.push({
      type: 'ambiguous_result',
      title: 'Размытый ожидаемый результат',
      message: 'Не описано, какое поведение системы считается правильным после выполнения задачи.',
      roleImpact: {
        manager: 'Сложно подтвердить, что команда сделала именно ожидаемый результат.',
        developer: 'Можно реализовать технически корректно, но не попасть в ожидание.',
        qa: 'Непонятно, какой результат считать успешным.'
      },
      recommendation: 'Описать наблюдаемое поведение системы после выполнения задачи.'
    });
  }

  if (!hasAcceptanceCriteriaSection) {
    score -= 20;

    communicationRisks.push({
      type: 'unverifiable_acceptance',
      title: 'Непроверяемые критерии приёмки',
      message: 'В задаче нет явных критериев, по которым можно понять, что она готова.',
      roleImpact: {
        manager: 'Приёмка будет зависеть от субъективного ощущения.',
        developer: 'Непонятно, какой объём работы считается достаточным.',
        qa: 'Невозможно построить полный чек-лист проверки.'
      },
      recommendation: 'Добавить критерии приёмки в формате проверяемых пунктов.'
    });
  }

  if (hasAny(body, ['как обсуждали', 'как договорились', 'как в прошлый раз'])) {
    score -= 10;

    communicationRisks.push({
      type: 'hidden_agreement',
      title: 'Скрытые договорённости',
      message: 'Описание ссылается на устное обсуждение, которое не сохранено в задаче.',
      roleImpact: {
        manager: 'Часть ожиданий остаётся вне письменного контура.',
        developer: 'Нужно искать контекст в чатах или памяти участников.',
        qa: 'Нельзя восстановить исходный смысл задачи по одному описанию.'
      },
      recommendation: 'Кратко перенести договорённость в описание задачи и добавить ссылку на источник.'
    });
  }

  if (!hasAny(body, ['пользователь', 'клиент', 'роль', 'сценарий', 'user', 'client', 'customer', 'scenario'])) {
    score -= 10;

    communicationRisks.push({
      type: 'missing_user_scenario',
      title: 'Нет пользовательского сценария',
      message: 'В описании не видно, кто и в какой ситуации столкнётся с изменением.',
      roleImpact: {
        manager: 'Сложнее объяснить ценность задачи.',
        developer: 'Реализация может уйти в техническую сторону без связи с пользователем.',
        qa: 'Сложнее выбрать реальные сценарии проверки.'
      },
      recommendation: 'Добавить короткий пользовательский сценарий: кто, что делает и какой результат ожидает.'
    });
  }

  if (!hasAny(body, ['проверить', 'qa', 'тест', 'test', 'expected', 'ожидается'])) {
    score -= 10;

    communicationRisks.push({
      type: 'qa_uncertainty',
      title: 'Неясность для тестирования',
      message: 'В задаче мало подсказок, что именно должен проверить QA.',
      roleImpact: {
        qa: 'Проверка будет строиться на догадках, а не на явных критериях.'
      },
      recommendation: 'Добавить раздел “Что проверить” или расширить критерии приёмки.'
    });
  }

  if (
    hasAny(body, ['реализовать', 'добавить endpoint', 'изменить метод', 'поменять компонент']) &&
    !hasAny(body, ['зачем', 'проблема', 'цель', 'пользователь', 'ценность'])
  ) {
    score -= 10;

    communicationRisks.push({
      type: 'implementation_without_goal',
      title: 'Решение описано без цели',
      message: 'В задаче есть намёк на реализацию, но не объяснена причина изменения.',
      roleImpact: {
        manager: 'Сложнее проверить, что реализация решает исходную проблему.',
        developer: 'Можно выполнить техническое действие без понимания цели.',
        qa: 'Сложнее проверить бизнес-ценность результата.'
      },
      recommendation: 'Добавить цель изменения и проблему, которую оно должно решить.'
    });
  }

  const finalScore = clampScore(score);

  return {
    score: finalScore,
    riskLevel: getRiskLevel(finalScore),
    communicationRisks
  };
}

export function formatClarityScoreMarkdown(result: ClarityScoreResult): string {
  const riskLevelText: Record<ClarityRiskLevel, string> = {
    low: 'низкий',
    medium: 'средний',
    high: 'высокий'
  };

  const risksMarkdown = result.communicationRisks.length > 0
    ? result.communicationRisks.map((risk, index) => {
      const roleImpact = [
        risk.roleImpact.manager ? `- PM/менеджер: ${risk.roleImpact.manager}` : null,
        risk.roleImpact.developer ? `- Разработчик: ${risk.roleImpact.developer}` : null,
        risk.roleImpact.qa ? `- QA: ${risk.roleImpact.qa}` : null
      ].filter(Boolean).join('\n');

      return [
        `### ${index + 1}. ${risk.title}`,
        '',
        risk.message,
        '',
        '**Влияние на роли:**',
        '',
        roleImpact || '- Не указано.',
        '',
        '**Как снизить риск:**',
        '',
        risk.recommendation
      ].join('\n');
    }).join('\n\n')
    : 'Коммуникационные риски не найдены.';

  return [
    '## 📊 Clarity Score',
    '',
    `**Оценка ясности:** ${result.score}/100`,
    '',
    `**Риск искажения смысла:** ${riskLevelText[result.riskLevel]}`,
    '',
    '---',
    '',
    '## Коммуникационные риски',
    '',
    risksMarkdown
  ].join('\n');
}
