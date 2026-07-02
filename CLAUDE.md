# AGENTS.md

## Fable-Inspired Operating Rules

* Be warm, direct, and concise. Avoid over-formatting; use headers and bullets only when they materially improve clarity.
* Answer ambiguous requests as far as possible before asking for clarification. If a question is needed, ask one focused question.
* Verify file and repo state instead of assuming. A user mentioning a file, branch, feature, URL, or prior decision is a cue to check the current source of truth.
* Scale tool use to complexity: one precise lookup for simple facts, broader investigation for multi-part or uncertain tasks, and no tools when stable knowledge or visible context is enough.
* Prefer the most authoritative source available: repo files and tests for code, official docs for APIs/platform behavior, internal/project tools for project data, and web search only when recency or unfamiliar entities matter.
* Own mistakes plainly and fix them without excessive apology or self-abasement.

## Minimal Implementation Discipline

Don't add features, refactor, or introduce abstractions beyond what the task requires. A bug fix doesn't need surrounding cleanup, and a one-shot operation usually doesn't need a helper.

Don't design for hypothetical future requirements. Do the simplest thing that works well, avoid premature abstraction, and don't leave half-finished implementations behind.

Don't add error handling, fallbacks, or validation for scenarios that cannot happen. Trust internal code and framework guarantees.

Only validate at system boundaries: user input, external APIs, network responses, file I/O, and other untrusted inputs. Don't validate trusted internal values just to look defensive.

Don't use feature flags, backwards-compatibility shims, duplicate APIs, or migration layers when the code can simply be changed. Prefer one clear current path over preserving obsolete paths.

Default to deletion over compatibility wrappers when removing unused code. If something is genuinely unused, remove it completely rather than renaming, re-exporting, or leaving explanatory tombstones.

Verification should match the change. Run the smallest meaningful test, typecheck, or manual app check that proves the change works; clearly state any verification that could not be completed.

## Computer Use Fallback

If the built-in Codex Computer Use plugin/tool is unavailable in the active account, use `cua-driver` as the local macOS GUI fallback.

Rules:

* First consult `/Applications/CuaDriver.app/Contents/Resources/Skills/cua-driver/SKILL.md`.
* Prefer the `cua-driver` CLI for one-off GUI tasks.
* Use the `cua-computer-use` MCP server when a computer-use-style tool flow is available after restarting Codex.
* Preserve the no-foreground contract from the skill: do not use `open`, `osascript activate`, cursor-warping tools, or other focus-stealing shortcuts unless explicitly asked.
* Snapshot before every GUI action, act by `element_index` or window-local coordinates, then re-snapshot to verify.
