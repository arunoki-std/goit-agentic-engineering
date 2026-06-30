# Feature: <name>
Date: YYYY-MM-DD
Session: chat.XXX — <title>

## Pipeline
| Agent | Model | Effort | Tokens (approx) |
|---|---|---|---|
| orchestrator | sonnet-4.6 | — | |
| planner | sonnet-4.6 | medium | |
| implementer-* | sonnet-4.6 | medium | |
| completion-reviewer | sonnet-4.6 | medium | |
| **Total subagent** | | | |

Token source: run `/context` at session end; "Messages" ≈ orchestrator, remaining named agents from handoff sizes. Target: 300–400k subagent.

## Quality
| Metric | Value | Target |
|---|---|---|
| BLOCKEDs | | 0 |
| Re-runs | | 0 |
| Backports / cherry-picks | | 0 |
| Patch / merge conflicts | | 0 |
| Files outside owner scope | | 0 |
| Stray artifacts | | 0 |
| Planning agents invoked | | ≤ 1 |
| Test result | | PASS |

Quality source: copy from `## Efficiency Metrics` in the completion-reviewer output.

## Session
Duration: Xm (first user message → wrap-up)
Notes:
