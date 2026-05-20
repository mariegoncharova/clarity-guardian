# Product And Engineering Audit

Date: 2026-05-20

## Audit Scope

Reviewed project structure, TypeScript modules, CLI scripts, configuration, tests, GitHub Actions, demo data, reports, documentation and portfolio positioning.

## Strengths

- Clear core problem: task descriptions often fail as PM / Engineering / QA handoff artifacts.
- TypeScript codebase is small and understandable.
- Existing bot flow still has practical value: GitHub Issue / PR analysis, managed comments, Jira sync and fallback checklist generation.
- The project already includes strong PM analytics modules: dashboard, retro, risk, readiness, sprint health, evidence brief, decision ledger and quick bug queue.
- Demo data covers multiple sources, statuses, risk levels, returned tasks, stuck tasks and before/after storytelling.
- Reports are deterministic and run without a backend or database.

## Weak Spots Found

- The product story was spread across README sections but lacked a compact product-grade architecture and roadmap entry point.
- There was no normal CI workflow for push / pull request validation; the existing workflow was product functionality, not repository CI.
- The tone analyzer had a strong built-in dictionary, but project-specific bad formulations were not configurable as a first-class concept.
- There was no single per-task health profile combining clarity, risk, readiness, lifecycle, QA risk and manager action.
- Generated reports existed in `reports/`, but portfolio-friendly sample outputs were not committed because `reports/` is ignored.
- `package.json` missed some discoverable commands external reviewers expect: `demo`, `report`, `typecheck`, `lint`.
- Architecture documentation lived mostly inside README, making the repo harder to scan quickly.

## Improvements Implemented

- Added configurable bad formulations dictionary with categories such as `vague`, `pressure`, `unclear_reference`, `missing_context`, `weak_acceptance` and `hidden_requirement`.
- Added configurable Clarity Score weights and thresholds.
- Added analytics config for ignored labels and statuses.
- Added `Task Health Profile`, a report that combines per-task clarity, risk, DoR/DoD, lifecycle, weak formulations, delivery risks, QA risks and next best action.
- Added a normal CI workflow with clean clone install, static TypeScript check, build, tests and demo generation.
- Added `ARCHITECTURE.md`, `ROADMAP.md` and portfolio-friendly examples.
- Added package scripts that make the project easier to evaluate: `demo`, `report`, `typecheck`, `lint`, `task:health`.

## Remaining Product Risks

- The tool currently infers many signals heuristically; larger real datasets will need calibration and false-positive review.
- Dashboard HTML is intentionally static and compact; a richer product would eventually need filtering and trend navigation.
- Risk thresholds are exposed in config, but deeper domain-specific risk scoring should be validated with real team data before overfitting.
- Lifecycle analytics depends on status history quality from external trackers.
- AI-assisted rewriting is deliberately not core because the project must work without secrets or network calls.

## Recommended Demo Narrative

1. Start with task handoff pain: unclear requirements create QA returns and delivery drag.
2. Show `npm run demo` and open `reports/demo/dashboard.html`.
3. Open `reports/demo/task-health-profile.md` to show how one task becomes an actionable profile.
4. Open `reports/demo/retro-report.md` to connect clarity with lifecycle friction.
5. Open `reports/demo/decision-ledger.md` to show mature PM thinking: problem, evidence, decision, owner and risk control.
6. Open `reports/demo/quick-bug-fix.md` to show operational focus on quick, safe bug fixes.

## Audit Conclusion

The project now reads less like a single GitHub bot and more like a compact PM analytics product: it keeps the original automation use case, but adds project-level reporting, lifecycle analytics, configurable communication rules and demo-ready outputs.
