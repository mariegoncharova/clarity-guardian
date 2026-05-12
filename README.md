# Clarity Guardian V2

**Clarity Guardian** is a portfolio-ready product tool for improving the quality of task descriptions in engineering teams.

It started as a GitHub Issue/PR bot that checked whether a task had enough context, expected result, and acceptance criteria. In **Version 2**, it becomes a lightweight analytics tool for PMs and product-minded teams: it analyzes task clarity across a project, tracks Clarity Score dynamics, prepares retro reports, and helps managers improve task wording.

The project is intentionally simple and demo-friendly: no heavy backend, no database server, no frontend framework. The V2 analytics pipeline works with JSON data, demo tasks, GitHub payloads, and Yandex Tracker issues.

---

## What Is New In V2

- Unified task model for GitHub, Jira, Yandex Tracker, files, and demo data.
- Yandex Tracker adapter with queue/query/key based import.
- Clarity Score history as JSONL.
- Project quality dashboard as JSON, Markdown, CSV, and static HTML.
- Retro report generation.
- Before/after comparison for portfolio storytelling.
- Research notes about possible correlation between task clarity, development time, QA returns, comments, and description changes.
- Manager recommendations tied to detected problems.
- Demo dataset that works without real GitHub, Jira, or Tracker access.

---

## Product Idea

Poorly written tasks create a communication gap between PM, developer, and QA. A task can be technically present in a tracker but still fail to explain:

- why the team is doing it;
- what user problem it solves;
- what behavior is expected;
- how QA should verify it;
- what counts as done.

Clarity Guardian turns this into visible, measurable signals:

- task-level **Clarity Score**;
- recurring problem categories;
- recommendations for managers;
- team-level dashboard;
- retro-ready reports.

---

## For Whom

- **Project Managers** who want clearer task handoff.
- **Product Managers** who need to connect tasks with user value.
- **QA engineers** who need testable acceptance criteria.
- **Engineering teams** that want fewer misunderstandings and fewer avoidable reworks.
- **Portfolio reviewers** who want to see product thinking, automation, and clear architecture in one project.

---

## Core Features

### Task Analysis

Clarity Guardian checks:

- required sections;
- empty or too short sections;
- vague wording and project-specific stop phrases;
- hidden agreements like “as discussed”;
- bug/task/story specific rules;
- strict and non-strict modes;
- Russian and English templates.

### Clarity Score

Each task receives a score from `0` to `100`.

Quality buckets:

- `80-100`: good;
- `50-79`: medium;
- `0-49`: poor.

The score is based on structural completeness, detected remarks, communication risks, and testability.

### Manager Recommendations

Recommendations are not random. They are tied to detected problems.

Examples:

- add business context;
- clarify expected result;
- add acceptance criteria as a checklist or Given/When/Then;
- add reproduction steps for bugs;
- replace vague wording with concrete requirements;
- split a task if it mixes multiple changes.

### Project Dashboard

The V2 dashboard includes:

- total analyzed tasks;
- average Clarity Score;
- number of good, medium, and poor tasks;
- top problems;
- status distribution;
- author and assignee distribution;
- lowest score tasks;
- score trend by analysis date.

### Retro Reports

Retro report includes:

- period summary;
- score distribution;
- top team problems;
- before/after dynamics;
- examples of tasks requiring attention;
- team recommendations;
- “what to improve in task writing” block.

### Research Hypothesis

The project includes a cautious analytics module for the hypothesis:

> Clearer tasks may correlate with faster development, fewer QA returns, fewer clarification comments, and fewer description changes.

The report does not claim causation. It uses careful wording:

- “may indicate correlation”;
- “visible in this project sample”;
- “requires validation on a larger dataset”.

---

## Architecture

```text
src/
  analyze.ts                 # existing task analysis and GitHub/Jira bot output
  clarity-score.ts           # Clarity Score and communication risks
  recommendations.ts         # manager recommendations tied to findings
  task-model.ts              # unified task model and adapters to old TaskPayload
  yandex-tracker.ts          # Yandex Tracker adapter/service
  analytics.ts               # dashboard, history, before/after, research data
  reports.ts                 # Markdown, CSV, HTML report formatting
  v2-report.ts               # V2 report CLI
  sync-github.ts             # GitHub comments/body sync
  sync-jira.ts               # Jira REST sync
  generate-test-checklist.ts # QA checklist generation
data/
  demo-tasks.json            # portfolio demo dataset
scripts/
  smoke-test.ts              # end-to-end smoke checks
templates/
  *.md                       # manager and tester templates
```

The old GitHub bot remains compatible. V2 is added as a modular reporting layer on top of the same analyzer.

---

## Quick Start

```bash
npm ci
npm run check
npm run build
npm run smoke
```

Run the V2 demo:

```bash
npm run v2:demo
```

Generated files:

```text
reports/demo/dashboard.json
reports/demo/dashboard.md
reports/demo/dashboard.html
reports/demo/retro-report.md
reports/demo/research-report.md
reports/demo/tasks.csv
reports/demo/before-after.json
reports/demo/clarity-history.jsonl
reports/demo/task-history.json
reports/demo/analysis-records.json
```

`reports/` is ignored by git because it is generated output.

---

## Demo Mode

Demo data is stored in:

```text
data/demo-tasks.json
```

It includes:

- good, medium, and poor tasks;
- before and after periods;
- tasks with and without QA returns;
- different development times;
- different authors, assignees, statuses, priorities, tags, and components.

This lets the project work in portfolio demos without real access to GitHub, Jira, or Yandex Tracker.

---

## Generate Reports From A File

Prepare a JSON array of unified tasks:

```json
[
  {
    "id": "TASK-1",
    "source": "file",
    "title": "Checkout success page",
    "body": "## Context\n...\n\n## Expected result\n...\n\n## Acceptance criteria\n- ...",
    "status": "Done",
    "author": "PM",
    "assignee": "Developer",
    "period": "after",
    "metrics": {
      "cycleTimeHours": 24,
      "qaReturns": 0,
      "commentsCount": 4,
      "descriptionChanges": 1
    }
  }
]
```

Run:

```bash
npm run build
node dist/v2-report.js \
  --input tasks.json \
  --out-dir reports/custom
```

---

## GitHub Setup

The workflow is stored in:

```text
.github/workflows/clarity-guardian.yml
```

It reacts to:

- opened/edited/labeled issues;
- opened/edited/labeled/ready_for_review pull requests.

Required permissions:

```yaml
permissions:
  contents: read
  issues: write
  pull-requests: write
```

The bot:

- analyzes the task;
- updates the Issue/PR description with a managed Clarity Guardian block;
- updates the previous bot comment instead of duplicating comments;
- generates a tester checklist when a task becomes ready for testing.

Optional secret:

```text
OPENAI_API_KEY=...
```

Without it, checklist generation uses local templates.

---

## Yandex Tracker Setup

Yandex Tracker integration is implemented in:

```text
src/yandex-tracker.ts
```

Environment variables:

```bash
YANDEX_TRACKER_TOKEN=...
YANDEX_TRACKER_ORG_ID=...
# or
CLOUD_ORG_ID=...

YANDEX_TRACKER_QUEUE=CHECKOUT
YANDEX_TRACKER_PROJECT=Checkout Project
YANDEX_TRACKER_BASE_URL=https://api.tracker.yandex.net
```

Fetch Tracker tasks as unified JSON:

```bash
npm run build
node dist/yandex-tracker.js \
  --output yandex-tasks.json
```

Or build a V2 report directly from Yandex Tracker:

```bash
YANDEX_TRACKER_TOKEN=... \
YANDEX_TRACKER_ORG_ID=... \
YANDEX_TRACKER_QUEUE=CHECKOUT \
node dist/v2-report.js \
  --source yandex \
  --out-dir reports/yandex
```

CLI overrides:

```bash
node dist/yandex-tracker.js --queue CHECKOUT --output tasks.json
node dist/yandex-tracker.js --project "Checkout Project" --output tasks.json
node dist/yandex-tracker.js --keys CHECKOUT-1,CHECKOUT-2 --output tasks.json
node dist/yandex-tracker.js --query 'Queue: CHECKOUT "Sort by": Updated DESC' --output tasks.json
```

The adapter reads:

- summary;
- description;
- status;
- assignee;
- author or createdBy;
- createdAt;
- updatedAt;
- type;
- priority;
- tags;
- components;
- queue/project.

Missing optional fields are handled with graceful fallback.

---

## Jira Setup

Jira sync remains available:

```bash
JIRA_BASE_URL=https://your-company.atlassian.net
JIRA_EMAIL=name@example.com
JIRA_API_TOKEN=...
```

Run:

```bash
node dist/sync-jira.js \
  --payload event.json \
  --analysis result.json \
  --analysis-comment comment.md \
  --issue-key CG-123
```

---

## Local Task Analysis

Create `event.json`:

```json
{
  "type": "issue",
  "title": "Проверить оплату после 3DS",
  "body": "## Контекст\nПользователь иногда не видит успешную оплату после 3DS.\n\n## Ожидаемый результат\nПосле успешного 3DS пользователь видит экран успеха.\n\n## Критерии приёмки\n- Оплата проходит успешно.\n- Ошибка банка показывает понятное сообщение.",
  "labels": ["bug"]
}
```

Run:

```bash
npm run build
node dist/analyze.js \
  --input event.json \
  --json-file result.json \
  --comment-file comment.md \
  --updated-body-file updated-body.md
```

---

## Configuration

Main config:

```text
clarity-guardian.config.json
```

Supports:

- `language`: `auto`, `ru`, `en`;
- `mode`: `strict`, `non-strict`;
- `updateDescription`;
- common and type-specific rules;
- project-specific stop phrases.

Example:

```json
{
  "language": "auto",
  "mode": "strict",
  "updateDescription": true,
  "stopPhrases": [
    {
      "phrase": "потом уточним",
      "level": "warning",
      "code": "deferred_context",
      "message": "Фраза оставляет незакрытый вопрос. Укажи, что именно нужно уточнить и у кого.",
      "languages": ["ru"]
    }
  ]
}
```

---

## Product Value

Clarity Guardian helps a team:

- reduce ambiguity before implementation starts;
- make task quality measurable;
- see recurring communication problems;
- prepare better retrospectives;
- connect task writing with delivery outcomes;
- make PM work visible through structured improvements.

---

## PM Value

For a PM portfolio, this project demonstrates:

- product problem framing;
- clear user value;
- lightweight analytics;
- integration thinking;
- prioritization of demo-ready value over unnecessary complexity;
- communication between PM, engineering, and QA;
- careful research framing without overstating causality.

---

## Testing

Smoke tests cover:

- Clarity Score and task analysis;
- manager recommendations;
- demo task analysis;
- before/after comparison;
- Markdown, JSON, CSV, and HTML exports;
- Yandex Tracker adapter and missing-field fallback;
- GitHub comment update behavior;
- Jira sync behavior;
- Docker configuration sanity check.

Run:

```bash
npm run smoke
```

Full check:

```bash
npm ci
npm run check
npm run build
npm run smoke
npm audit --audit-level=moderate
git diff --check
```

---

## Documentation

- [Communication Guide](docs/COMMUNICATION_GUIDE.md)
- [Scientific Communication Rationale](docs/SCIENTIFIC_COMMUNICATION.md)
- [Portfolio Case](docs/PORTFOLIO_CASE.md)

---

## License

Project is public for portfolio review and educational demonstration.
