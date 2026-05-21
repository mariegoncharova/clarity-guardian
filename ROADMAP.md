# Roadmap

Clarity Guardian is intentionally lightweight today: it proves the PM analytics workflow without a heavy backend or SaaS shell. The roadmap shows how it can grow into a commercial product while keeping a clear path from portfolio demo to team workspace.

## V1 - GitHub Issue / PR Clarity Bot

Status: implemented.

- Analyze GitHub Issues and Pull Requests.
- Check required sections: context, expected result and acceptance criteria.
- Support strict and non-strict modes.
- Detect stop phrases and unclear wording.
- Maintain a managed Clarity Guardian block without duplicating bot comments.
- Generate QA checklist from local templates when no OpenAI key is available.
- Sync analysis to Jira when configured.

## V2 - PM Analytics And Reports

Status: current focus.

- Unified task model across GitHub, Jira, Yandex Tracker, JSON and demo data.
- Clarity Score and communication risk analysis.
- Tone of Voice Analyzer and configurable bad formulations dictionary.
- Project Quality Dashboard.
- Retro-ready lifecycle analytics: lead time, cycle time, stuck tasks, reopened tasks and bottlenecks.
- Before / After Comparison for process improvement storytelling.
- Risk Detection, Definition of Ready, Definition of Done and Sprint Health.
- Refinement Agenda, Evidence Brief, Decision Ledger, Quick Bug Fix Queue and Task Health Profile.
- Markdown, JSON, CSV and static HTML exports.
- Demo mode that works on a clean clone.

## V3 - Integrations And Dashboards

Potential next phase.

- GitHub App packaging and clearer installation guide.
- Jira and Yandex Tracker scheduled exports.
- GitLab / Linear / YouTrack adapters through the same `TaskProvider` pattern.
- Historical report snapshots for trend analysis.
- Lightweight static dashboard with filters by sprint, team, assignee, status and risk.
- Config presets for PM, QA, engineering lead and product analyst views.
- Team-level quality goals and warnings for recurring bottlenecks.

## V4 - SaaS / Team Workspace Potential

Longer-term product direction.

- Workspace setup for multiple teams and projects.
- Saved dictionaries and process rules per team.
- Role-specific dashboards for PM, QA, Engineering Lead and Product.
- Scheduled retro briefs and planning readiness checks.
- Secure task-source connectors and audit logs.
- Collaborative recommendations workflow: assign owner, track action, measure improvement.
- Optional AI-assisted rewriting with deterministic fallback and strict privacy controls.

## Product Bets To Validate

- Teams will adopt task-quality analytics if reports are useful for retro and planning, not just for blocking issues.
- PMs and QA gain the most value when the tool turns vague findings into concrete next actions.
- Lightweight local exports are enough for early usage before building a hosted workspace.
- The strongest commercial angle is process improvement: fewer unclear tasks, fewer testing returns and faster refinement.
