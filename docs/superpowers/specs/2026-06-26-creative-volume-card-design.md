# Creative Volume Card Design

## Goal

Make `CreativeVolumeCard` feel like a premium SaaS creative-capacity diagnostic card instead of a generic card.

## Scope

Update only `CreativeVolumeCard` inside `components/dashboard-shell.tsx` around lines 4108-4146. Do not change creative volume assessment logic, visible ad set filtering, fallback display logic, badge variants, summary copy, diagnostic tone, or print behavior.

## Design

### Container

- Replace the outer generic `Card` with a custom SaaS surface using `rounded-2xl border bg-card/70 p-4 shadow-sm sm:p-5`.
- Preserve `data-print-flow`.
- Preserve diagnostic accent styling by keeping `diagnosticAccentClass(assessment.variant)` on the outer wrapper.

### Header

- Replace `CardHeader`, `CardTitle`, and `CardDescription` with a custom header.
- Add a localized eyebrow: `Creative Capacity` / `Năng lực creative`.
- Keep the existing visible title and description copy exactly.
- Preserve the assessment label badge and variant exactly.

### Body

- Replace `CardContent` with a plain body container using `mt-5 flex flex-col gap-3`.
- Wrap the assessment summary in `rounded-xl border bg-background/50 p-4`.
- Preserve summary copy exactly.
- Preserve `displayAdsets` ordering, visibility, and fallback logic.
- Upgrade ad set rows from `rounded-lg border p-2` to `rounded-xl border bg-background/50 px-3 py-2.5`.
- Preserve ad set names, creative count badges, badge variants, reasons, and tabular number styling exactly.
- Preserve `DiagnosticNextStep kind="creativeVolume"` and tone logic exactly.

## Accessibility

- Preserve heading order with a plain `h2` title.
- Do not add or remove interactive controls.
- Preserve readable row labels, counts, and badge semantics.

## Verification

- Run `npm run build`.
- Run `git diff --check`.
- Verify the ads route still renders.
