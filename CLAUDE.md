# AGENTS.md

## Superpowers First

Before any reply, clarification question, plan, file read, tool call, or code change, first consult the `using-superpowers` skill:

`/Users/tienduonn/.codex/skills/using-superpowers/SKILL.md`

Rules:

* Treat `using-superpowers` as the default first skill for every new top-level user request.
* If there is even a small chance another skill applies, check `using-superpowers` first, then use any additional relevant skills it points to.
* Do not skip this step because the task seems simple, because more context is needed, or because you think you already remember the skill.
* User instructions override skill instructions when they conflict.
* If operating as a delegated subagent and the skill explicitly says to skip in that context, follow the skill.

## Active Skill Catalog

After consulting `using-superpowers`, autoreview the complexity of the user request. 

* If the task is complex and need more than the skills provided in codex default skill list, then consult the `active-skill-catalog` skill for skill routing:

`/Users/tienduonn/.codex/skills/active-skill-catalog/SKILL.md`

Rules:

* Use it as the smart index for full skill descriptions and paths when the built-in skill list is truncated, ambiguous, or insufficient for routing.
* Do not copy skill descriptions into this file. Keep `AGENTS.md` small; let the generated catalog hold the full descriptions.
* Do not read or paste the full catalog by default. Run `/Users/tienduonn/.codex/skills/active-skill-catalog/scripts/search-skills.py <query> --limit 12` first, then load only the matching skill files needed for the task.
* IMPORTANT: IGNORE IF YOU THINK THE SKILL THAT IS INDEXED IS IRRELEVANT
* Rebuild the catalog after enabling, disabling, installing, deleting, or renaming skills.

## Computer Use Fallback

If the built-in Codex Computer Use plugin/tool is unavailable in the active account, use `cua-driver` as the local macOS GUI fallback.

Rules:

* First consult `/Applications/CuaDriver.app/Contents/Resources/Skills/cua-driver/SKILL.md`.
* Prefer the `cua-driver` CLI for one-off GUI tasks.
* Use the `cua-computer-use` MCP server when a computer-use-style tool flow is available after restarting Codex.
* Preserve the no-foreground contract from the skill: do not use `open`, `osascript activate`, cursor-warping tools, or other focus-stealing shortcuts unless explicitly asked.
* Snapshot before every GUI action, act by `element_index` or window-local coordinates, then re-snapshot to verify.
