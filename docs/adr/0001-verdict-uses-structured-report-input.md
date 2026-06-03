# Verdict uses structured report input

The Verdict endpoint accepts structured report input as its canonical contract instead of prompt-only text. This keeps local ads-rule generation reliable when AI providers fail, avoids parsing report data back out of prompt prose, and still allows prompt-only requests as temporary backward compatibility during migration. The `prompt` provider mode produces a complete deterministic Verdict from local ads rules and never calls an AI provider.

`auto` is reliable-first: generate the deterministic local Verdict, optionally enhance it with OpenAI when `OPENAI_API_KEY` exists, and never call OpenRouter. OpenRouter is used only when the user explicitly selects `openrouter`, because current OpenRouter free-model behavior is too unreliable for default report generation.

OpenAI in `auto` performs Verdict Enhancement: it may improve clarity, prioritization language, Vietnamese phrasing, and client-facing wording, but local ads rules own the strategic claims. The enhancement must preserve the local Verdict's core risks, winners, losers, budget moves, and tests unless new items are clearly marked as assumptions.
