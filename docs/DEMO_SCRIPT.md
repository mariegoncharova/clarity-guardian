# Demo Script

This guide is a short route for reviewing Clarity Guardian as a working PM analytics tool.

## 1. Run the main demo

```bash
npm ci
npm test
npm run demo
```

Open:

```text
reports/demo/dashboard.html
```

What to show:

- project-level overview;
- Clarity Score and SMART Score side by side;
- top recurring task-quality problems;
- weakest tasks that need refinement.

Main point:

> Clarity Guardian turns backlog quality into visible project-level signals.

## 2. Show task-level diagnosis

Open:

```text
reports/demo/task-health-profile.md
```

What to show:

- each task has health status;
- Clarity Score, delivery risk, DoR/DoD and QA risk are combined;
- every task gets a next best action.

Main point:

> The project does not only detect missing sections. It turns findings into a triage profile.

## 3. Show refinement workflow

Open:

```text
reports/demo/refinement-agenda.md
```

What to show:

- tasks are prioritized for discussion;
- the report gives questions, decisions to capture and suggested participants;
- unclear tasks become a meeting agenda.

Main point:

> The tool supports the PM workflow before development starts.

## 4. Show decision traceability

Open:

```text
reports/demo/decision-ledger.md
```

What to show:

- problem, evidence, decision, owner and verification are checked together;
- weak decisions become traceability gaps;
- scientific communication is integrated through evidence and careful reasoning.

Main point:

> Clarity Guardian treats tasks as decision artifacts, not just text blocks.

## 5. Show release readiness

Open:

```text
reports/demo/release-guard.md
```

What to show:

- release decision: `go`, `review_required` or `no_go`;
- QA gaps, blockers, risky domains and rollback notes;
- tasks with unclear requirements become release risks.

Main point:

> Quality of task descriptions affects release confidence.

## 6. Show the learning loop

Open:

```text
reports/demo/retro-report.md
```

What to show:

- lead time, cycle time, stuck tasks and reopened tasks;
- before/after comparison;
- careful interpretation without claiming false causality.

Main point:

> The project closes the loop from task quality to retro learning.

## 7. Show SMART Task Check

Run:

```bash
npm run smart:demo
```

Open:

```text
reports/smart-demo/dashboard.md
reports/smart-demo/tasks.csv
reports/smart-demo/analysis-records.json
```

What to show:

- weak task: vague and not measurable;
- medium task: understandable but missing metrics and timebox;
- strong task: specific, measurable, relevant and time-bound.

Main point:

> Clarity Score checks description quality. SMART Score checks goal-setting quality.

## 8. Short pitch

Use this version when explaining the project:

> Clarity Guardian is a local PM analytics tool for task quality. It normalizes tasks from trackers, calculates Clarity and SMART scores, detects risk and evidence gaps, then generates reports for planning, refinement, QA handoff, release readiness and retro. It is deterministic, TypeScript-based and designed as a practical decision-support layer over existing task trackers.

## 9. What makes it professional

- TypeScript strict mode.
- Unified task model.
- Source adapters for GitHub, Jira, Yandex Tracker and JSON.
- Deterministic local analysis.
- Configurable dictionaries and thresholds.
- Markdown, JSON, CSV and static HTML exports.
- Unit tests and end-to-end smoke tests.
- Demo datasets for reproducible review.
