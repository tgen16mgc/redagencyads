import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(__dirname, "../../components/dashboard/competitor-evidence-workspace.tsx"),
  "utf8",
);
const shellSource = readFileSync(resolve(__dirname, "../../components/dashboard-shell.tsx"), "utf8");

describe("competitor evidence workbench trust controls", () => {
  it("disables manual verification when the Meta evidence source is not trusted", () => {
    expect(source).toContain(
      '<ToggleGroupItem value="accepted" className="min-h-11" disabled={!selectedEvidenceSourceUrl || !selectedAd.evidence.matchedToCompetitor}>',
    );
    expect(source).toContain("safeEvidenceSourceUrl(selectedAd?.evidence?.sourceUrl)");
    expect(shellSource).toContain('status === "accepted" && target?.evidence && !target.evidence.matchedToCompetitor');
  });

  it("keeps the action dock persistent with content clearance and avoids a nested main landmark", () => {
    expect(source).toContain('position="fixed"');
    expect(source).toContain('pb-[var(--action-dock-clearance)]');
    expect(source).not.toContain("<main");

    const sidebarInset = shellSource.slice(
      shellSource.indexOf("<SidebarInset>"),
      shellSource.indexOf("</SidebarInset>") + "</SidebarInset>".length,
    );
    expect(sidebarInset).not.toContain("<main");
  });

  it("defaults to matched ads, keeps all collected ads browsable, and shows manual evidence", () => {
    expect(source).toContain('React.useState<EvidenceFilter>("matched")');
    expect(source).toContain('<ToggleGroupItem value="all"');
    expect(source).toContain('<ToggleGroupItem value="matched"');
    expect(source).toContain("visibleManual.map");
    expect(source).toContain('data-evidence-id={row.id}');
  });

  it("uses a full-width mobile setup sheet with a persistent footer action", () => {
    expect(source).toContain('data-[side=right]:w-full data-[side=right]:sm:max-w-xl');
    expect(source).toContain("<SheetFooter");
    expect(source).toContain("Meta Ad Library URLs");
    expect(source).toContain('ref={libraryUrlsRef}');
  });

  it("plays video and Reel media inside the library and detail sheet", () => {
    expect(source).toContain("<video");
    expect(source).toContain("controls");
    expect(source).toContain("playsInline");
    expect(source).toContain('preload="metadata"');
    expect(source).toContain("<EvidenceMedia ad={selectedAd}");
  });

  it("turns zero-match collection into a recovery flow", () => {
    expect(source).toContain("zeroMatchCollection");
    expect(source).toContain("Add exact Ad Library URL");
    expect(source).toContain("browseCollectedAds");
    expect(source).toContain('workflowStage === "recover"');
  });

  it("counts manual notes as matched only when an advertiser was identified", () => {
    expect(source).toContain("const matchedManual = manualEvidence.filter((row) => Boolean(row.advertiser))");
    expect(source).toContain('statusFilter === "matched" ? Boolean(row.advertiser)');
  });

  it("focuses and selects the first pending manual note from the review action", () => {
    expect(source).toContain("setFocusPendingManualEvidence(true)");
    expect(source).toContain("ref={manualEvidenceRef}");
    expect(source).toContain("textarea.setSelectionRange(start, start + firstPendingManualText.length)");
  });

  it("shows the complete market summary without truncating the decision brief", () => {
    expect(source).toContain(
      '<p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{result.summary}</p>',
    );
    expect(source).not.toContain("compactText(result.summary");
  });
});
