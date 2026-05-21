# Demo Data

The project keeps two demo datasets on purpose:

- `demo-tasks.json` is the portfolio before/after dataset used by `npm run demo`. It is optimized for the first reviewer experience: dashboard, before/after comparison, research notes and readable static HTML.
- `demo_tasks.json` is the richer lifecycle dataset used by focused PM analytics reports such as retro, risk, readiness, sprint health, decision ledger, quick bug fix and task health profile. It contains more status history, reopened tasks, blockers and QA return examples.

Both files use the same `UnifiedTask` shape after normalization, so they exercise the same analysis pipeline.

Useful commands:

```bash
npm run demo
npm run task:health -- --input data/demo_tasks.json --output reports/task_health_profile.md
npm run retro -- --input data/demo_tasks.json --output reports/retro_report.md
npm run risk -- --input data/risk-radar-demo-tasks.json --output reports/risk_radar_report.md
```

`risk-radar-demo-tasks.json` is a focused three-task dataset for Risk Radar: one low-risk task, one medium-risk task and one high-risk task.
