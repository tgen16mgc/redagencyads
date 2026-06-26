# Audience Overlap Card Design

## Goal

Make `AudienceOverlapCard` feel like a premium SaaS audience-overlap diagnostic card instead of a generic card.

## Scope

Update only `AudienceOverlapCard` inside `components/dashboard-shell.tsx` around lines 4282-4318. Do not change overlap assessment logic, pair rendering, similarity formatting, badge variants, summary copy, diagnostic tone, or print behavior.

## Design

### Container

- Replace the outer generic `Card` with a custom SaaS surface using `rounded-2xl border bg-card/70 p-4 shadow-sm sm:p-5`.
- Preserve `data-print-flow`.
- Preserve diagnostic accent styling by keeping `diagnosticAccentClass(overlap.variant)` on the outer wrapper.

### Header

- Replace `CardHeader`, `CardTitle`, and `CardDescription` with a custom header.
- Add a localized eyebrow: `Audience Map` / `Bản đồ đối tượng`.
- Keep the existing visible title and description copy exactly.
- Preserve the overlap label badge and variant exactly.

### Body

- Replace `CardContent` with a plain body container using `mt-5 flex flex-col gap-3`.
- Wrap the overlap summary in `rounded-xl border bg-background/50 p-4`.
- Preserve summary copy exactly.
- Preserve pair ordering, key construction, similarity formatting, and audience names exactly.
- Upgrade pair rows from `rounded-lg border p-2` to `rounded-xl border bg-background/50 px-3 py-2.5`.
- Preserve `DiagnosticNextStep kind="audienceOverlap"` and tone logic exactly.

## Accessibility

- Preserve heading order with a plain `h2` title.
- Do not add or remove interactive controls.
- Preserve readable pair labels, similarity text, and badge semantics.

## Verification

- Run `npm run build`.
- Run `git diff --check`.
- Verify the ads route still renders.
