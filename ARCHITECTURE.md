# Architecture

Clarity Guardian is a lightweight TypeScript/Node.js PM analytics tool. It has no server, database, or heavy frontend: data enters through adapters or JSON files, gets normalized into a unified task model, then flows through analysis and report modules.

## Data Flow

```text
GitHub / Jira / Yandex / JSON / demo data
  -> adapters and normalizers
  -> UnifiedTask[]
  -> task clarity analysis
  -> risk, readiness, lifecycle, decision and health analytics
  -> Markdown / JSON / CSV / static HTML reports
```

## Main Layers

### Adapters

- `src/prepare-event-payload.ts` converts GitHub event payloads into task payloads.
- `src/sync-github.ts` updates GitHub comments and managed description blocks without duplication.
- `src/sync-jira.ts` syncs analysis comments to Jira when configured.
- `src/yandex-tracker.ts` fetches Yandex Tracker tasks and converts them into `UnifiedTask`.
- `src/task-model.ts` normalizes file/demo tasks and builds task payloads for analysis.

### Core Analysis

- `src/analyze.ts` is the single-task analysis pipeline used by the bot flow.
- `src/config.ts` loads project rules: language, strict mode, required sections, stop phrases, bad formulations, scoring weights, thresholds and ignored labels/statuses.
- `src/clarity-score.ts` calculates Clarity Score and communication risks.
- `src/analyzers/toneOfVoiceAnalyzer.ts` detects weak tone, pressure, vague wording and configurable bad formulations.
- `src/clarity-fix-suggestions.ts` turns findings into PM-friendly questions and draft fixes.

### Analytics

- `src/analytics.ts` builds project dashboard data, before/after comparison, history and research notes.
- `src/retro-analyzer.ts` calculates lead time, cycle time, time in status, stuck tasks, reopened tasks and bottlenecks.
- `src/risk/` evaluates delivery risk.
- `src/readiness/` checks Definition of Ready and Definition of Done.
- `src/sprint-health/` summarizes sprint health.
- `src/decision-ledger.ts` checks decision traceability from problem to evidence, owner, verification and risk control.
- `src/task-health-profile.ts` creates per-task health profiles and a project quality summary.
- `src/quick-bug-fix.ts` separates quick, safe bug fixes from unclear or risky defects.

### Reports

- `src/reports.ts` formats dashboard, retro, research and CSV exports.
- `src/report-utils.ts` contains shared Markdown/JSON/CSV helpers.
- Dedicated report modules expose CLI-friendly Markdown, JSON and CSV output.
- `src/v2-report.ts` generates the full demo/report bundle.

### Tests and Smoke Checks

- `tests/` covers focused business logic.
- `scripts/smoke-test.ts` runs end-to-end checks for CLI scripts, exports, integrations and generated reports.
- `.github/workflows/ci.yml` verifies clean clone behavior with `npm ci`, TypeScript checks, build, tests and demo generation.

## Unified Task Model

All sources are normalized into `UnifiedTask`:

```ts
interface UnifiedTask {
  id: string;
  source: 'github' | 'jira' | 'yandex-tracker' | 'demo' | 'file';
  title: string;
  body: string;
  status?: string;
  assignee?: string;
  author?: string;
  statusHistory?: StatusHistoryEntry[];
  labels?: string[];
  workItemType?: 'bug' | 'task' | 'story' | 'research' | 'tech_debt';
  context?: string;
  expectedResult?: string;
  acceptanceCriteria?: string[];
  period?: 'before' | 'after';
  metrics?: TaskMetrics;
}
```

This keeps source-specific parsing outside the analytics layer.

## Adding a New Task Source

1. Create an adapter that implements `TaskProvider`.
2. Convert external records into `UnifiedTask`.
3. Normalize missing optional fields to empty arrays or `undefined`.
4. Reuse `npm run v2:report -- --input tasks.json --out-dir reports/custom`.
5. Add a smoke test for missing fields, empty descriptions and representative lifecycle data.

## Design Principles

- Keep the product demo local and deterministic.
- Prefer typed data transformations over ad hoc string handling.
- Keep reports readable for PM, QA and engineering readers.
- Treat analytics as decision support, not as absolute truth.
- Add integrations through adapters, not by mixing source-specific logic into scoring.
