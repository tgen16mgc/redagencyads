"use client";

import * as React from "react";
import { AudioLinesIcon, ImageIcon, Layers3Icon, UploadCloudIcon, WandSparklesIcon } from "lucide-react";
import type { CreativeAssetSummary } from "@/lib/creative-dam";
import { jsonFetch } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

export function CreativeLab({ language }: { language: "en" | "vi" }) {
  const isVietnamese = language === "vi";
  const [assets, setAssets] = React.useState<CreativeAssetSummary[]>([]);
  const [file, setFile] = React.useState<File | null>(null);
  const [concept, setConcept] = React.useState("");
  const [hook, setHook] = React.useState("");
  const [tags, setTags] = React.useState("");
  const [rightsExpiry, setRightsExpiry] = React.useState("");
  const [name, setName] = React.useState("");
  const [platform, setPlatform] = React.useState("multi");
  const [talent, setTalent] = React.useState("");
  const [clusters, setClusters] = React.useState<Array<{ id: string; label: string; size: number; roas: number; cpa: number }>>([]);
  const [analysis, setAnalysis] = React.useState<{ title: string; result: unknown; source?: string; model?: string; warning?: string } | null>(null);
  const [analysisAssetId, setAnalysisAssetId] = React.useState("");
  const [hookCurveJson, setHookCurveJson] = React.useState('[{"second":0,"retention":1},{"second":1,"retention":0.82},{"second":2,"retention":0.68},{"second":3,"retention":0.54}]');
  const [frequency, setFrequency] = React.useState(3.4);
  const [previousRoas, setPreviousRoas] = React.useState(2.1);
  const [currentRoas, setCurrentRoas] = React.useState(1.5);
  const [bpm, setBpm] = React.useState(122);
  const [speechRatio, setSpeechRatio] = React.useState(0.7);
  const [energy, setEnergy] = React.useState(0.75);
  const [elementTranscript, setElementTranscript] = React.useState("");
  const [detectedLabels, setDetectedLabels] = React.useState("");
  const [hasFace, setHasFace] = React.useState(false);
  const [hasTextOverlay, setHasTextOverlay] = React.useState(false);
  const [hasCta, setHasCta] = React.useState(false);
  const [copyVariantsJson, setCopyVariantsJson] = React.useState('[{"id":"headline-a","headline":"Save 20% today","primaryText":"A direct offer","cta":"Shop Now","impressions":1000,"clicks":80,"conversions":18},{"id":"headline-b","headline":"Meet your new routine","primaryText":"A benefit-led story","cta":"Learn More","impressions":1000,"clicks":65,"conversions":12}]');
  const [elementSamplesJson, setElementSamplesJson] = React.useState('[{"tags":["face","product"],"impressions":1000,"clicks":90,"conversions":20},{"tags":["product"],"impressions":1000,"clicks":60,"conversions":12},{"tags":["text_overlay"],"impressions":1000,"clicks":55,"conversions":10}]');
  const [audioSamplesJson, setAudioSamplesJson] = React.useState('[{"classification":{"mood":"energetic","tempo":"fast","mode":"voiceover","speechRatio":0.7},"impressions":1000,"clicks":90,"conversions":20},{"classification":{"mood":"calm","tempo":"slow","mode":"music_only","speechRatio":0.1},"impressions":1000,"clicks":55,"conversions":9}]');
  const [clusterEvidence, setClusterEvidence] = React.useState<{ source?: string; model?: string; warning?: string }>({});
  const [linkDrafts, setLinkDrafts] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const load = React.useCallback(() => Promise.all([
    jsonFetch<{ assets: CreativeAssetSummary[] }>("/api/creatives/assets", { timeoutMs: 8000 }),
    jsonFetch<{ clusters: Array<{ id: string; label: string; size: number; roas: number; cpa: number }>; source?: string; model?: string; warning?: string }>("/api/creatives/clusters", { timeoutMs: 8000 }),
  ]).then(([assetData, clusterData]) => { setAssets(assetData.assets); setAnalysisAssetId((current) => current || assetData.assets[0]?.id || ""); setClusters(clusterData.clusters); setClusterEvidence({ source: clusterData.source, model: clusterData.model, warning: clusterData.warning }); }), []);
  React.useEffect(() => { void load().catch(() => undefined); }, [load]);

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
    setLoading(true); setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("name", name);
      form.set("platform", platform);
      form.set("concept", concept);
      form.set("hook", hook);
      form.set("talent", talent);
      form.set("tags", tags);
      form.set("rightsExpiry", rightsExpiry);
      const response = await fetch("/api/creatives/assets", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Upload failed.");
      setFile(null); setName(""); setPlatform("multi"); setConcept(""); setHook(""); setTalent(""); setTags(""); setRightsExpiry("");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Upload failed."); }
    finally { setLoading(false); }
  }

  async function runAnalysis(body: unknown, title: string) {
    setError("");
    try { const data = await jsonFetch<{ result: unknown; source?: string; model?: string; warning?: string }>("/api/creatives/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), timeoutMs: 10000 }); setAnalysis({ title, result: data.result, source: data.source, model: data.model, warning: data.warning }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Creative analysis failed."); }
  }

  function runHookAnalysis() {
    try { void runAnalysis({ analysis: "hook", curve: JSON.parse(hookCurveJson) }, "Hook retention"); }
    catch { setError("Hook curve must be a JSON array of { second, retention } points."); }
  }

  function runStructuredAnalysis(analysisType: "copy" | "element_correlation" | "audio_correlation", field: "variants" | "samples", value: string, title: string) {
    try { void runAnalysis({ analysis: analysisType, [field]: JSON.parse(value) }, title); }
    catch { setError(`${title} input must be a valid JSON array.`); }
  }

  async function derive(asset: CreativeAssetSummary) {
    setLoading(true); setError("");
    try { await jsonFetch(`/api/creatives/assets/${encodeURIComponent(asset.id)}/derivatives`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ratios: ["9:16", "1:1", "4:5", "16:9"], caption: asset.hook, overlayText: asset.concept }), timeoutMs: 300000 }); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Derivative generation failed."); }
    finally { setLoading(false); }
  }

  async function addVersion(asset: CreativeAssetSummary, versionFile: File | null) {
    if (!versionFile) return;
    setLoading(true); setError("");
    try {
      const form = new FormData();
      form.set("file", versionFile);
      const response = await fetch(`/api/creatives/assets/${encodeURIComponent(asset.id)}/versions`, { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Version upload failed.");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Version upload failed."); }
    finally { setLoading(false); }
  }

  async function linkAds(asset: CreativeAssetSummary) {
    setLoading(true); setError("");
    try {
      const linkedAdIds = (linkDrafts[asset.id] || asset.linkedAdIds.join(",")).split(",").map((item) => item.trim()).filter(Boolean);
      await jsonFetch(`/api/creatives/assets/${encodeURIComponent(asset.id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ linkedAdIds }), timeoutMs: 8000 });
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Ad linkage failed."); }
    finally { setLoading(false); }
  }

  return <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
    <Card className="h-fit">
      <CardHeader><div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-xl border bg-background"><UploadCloudIcon className="size-4" /></span><div><CardTitle>{isVietnamese ? "Upload asset" : "Upload asset"}</CardTitle><CardDescription>{isVietnamese ? "Tag, version và quản lý quyền sử dụng." : "Tag, version, and manage usage rights."}</CardDescription></div></div></CardHeader>
      <CardContent><form onSubmit={upload} className="grid gap-4"><FieldGroup><Field><FieldLabel>{isVietnamese ? "Creative file" : "Creative file"}</FieldLabel><Input aria-label="Creative file" type="file" accept="image/*,video/*" onChange={(event) => setFile(event.target.files?.[0] || null)} required /><FieldDescription>{isVietnamese ? "Image hoặc video, tối đa 250 MB." : "Image or video, up to 250 MB."}</FieldDescription></Field><Field><FieldLabel>Name</FieldLabel><Input aria-label="Creative name" value={name} onChange={(event) => setName(event.target.value)} /></Field><Field><FieldLabel>Platform</FieldLabel><select aria-label="Creative platform" value={platform} onChange={(event) => setPlatform(event.target.value)} className="h-9 rounded-lg border bg-background px-2 text-sm text-foreground"><option value="multi">Multi-platform</option><option value="meta">Meta</option><option value="tiktok">TikTok</option><option value="google_ads">Google Ads</option><option value="youtube">YouTube</option><option value="linkedin">LinkedIn</option></select></Field><Field><FieldLabel>Concept</FieldLabel><Input aria-label="Creative concept" value={concept} onChange={(event) => setConcept(event.target.value)} /></Field><Field><FieldLabel>Hook</FieldLabel><Input aria-label="Creative hook" value={hook} onChange={(event) => setHook(event.target.value)} /></Field><Field><FieldLabel>Talent</FieldLabel><Input aria-label="Creative talent" value={talent} onChange={(event) => setTalent(event.target.value)} /></Field><Field><FieldLabel>Tags</FieldLabel><Input aria-label="Creative tags" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="ugc, testimonial, offer" /></Field><Field><FieldLabel>{isVietnamese ? "Rights expiry" : "Rights expiry"}</FieldLabel><Input aria-label="Rights expiry" type="date" value={rightsExpiry} onChange={(event) => setRightsExpiry(event.target.value)} /></Field></FieldGroup>{error ? <p className="text-sm text-destructive">{error}</p> : null}<Button type="submit" disabled={!file || loading}>{loading ? (isVietnamese ? "Đang xử lý…" : "Processing…") : (isVietnamese ? "Lưu asset" : "Save asset")}</Button></form></CardContent>
    </Card>
    <Card className="h-fit">
      <CardHeader><div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-xl border bg-background"><Layers3Icon className="size-4" /></span><div><CardTitle>{isVietnamese ? "Creative asset library" : "Creative asset library"}</CardTitle><CardDescription>{assets.length} {isVietnamese ? "asset với creative_id bất biến." : "assets with immutable creative IDs."}</CardDescription></div></div></CardHeader>
      <CardContent>{assets.length ? <div className="divide-y rounded-xl border">{assets.map((asset) => <div key={asset.id} className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_260px] md:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><ImageIcon className="size-4 text-muted-foreground" /><p className="truncate text-sm font-semibold">{asset.name}</p><Badge variant="secondary">{asset.format}</Badge><Badge variant="outline">{asset.platform}</Badge>{asset.rightsExpiry && asset.rightsExpiry < new Date().toISOString().slice(0, 10) ? <Badge variant="destructive">Rights expired</Badge> : null}</div><p className="mt-1 truncate text-xs text-muted-foreground">{asset.creativeId} · {asset.talent || "talent not tagged"}</p><div className="mt-2 flex flex-wrap gap-1">{asset.tags.map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}</div><p className="mt-2 text-xs text-muted-foreground">{asset.versions.length} version(s) · {asset.derivatives.filter((item) => item.status === "ready").length}/4 derivatives ready · {asset.linkedAdIds.length} linked ads</p></div><div className="grid gap-2"><Input aria-label={`Linked ad IDs for ${asset.name}`} value={linkDrafts[asset.id] ?? asset.linkedAdIds.join(", ")} onChange={(event) => setLinkDrafts((current) => ({ ...current, [asset.id]: event.target.value }))} placeholder="Meta/Google/TikTok ad IDs" /><div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => void linkAds(asset)}>Link ad IDs</Button><label className="inline-flex h-8 cursor-pointer items-center rounded-lg border px-3 text-xs font-medium hover:bg-muted"><input type="file" accept="image/*,video/*" className="sr-only" onChange={(event) => { void addVersion(asset, event.target.files?.[0] || null); event.currentTarget.value = ""; }} />Add version</label><Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => void derive(asset)}><WandSparklesIcon data-icon="inline-start" />4 ratios</Button></div></div></div>)}</div> : <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{isVietnamese ? "Upload asset đầu tiên để bắt đầu DAM-lite." : "Upload the first asset to start the DAM-lite library."}</div>}</CardContent>
    </Card>
    <Card className="xl:col-span-2">
      <CardHeader><div className="flex items-center gap-3"><AudioLinesIcon className="size-4" /><div><CardTitle>Creative attribution workbench</CardTitle><CardDescription>Analyze observed retention, copy, visual elements, and audio against supplied performance evidence.</CardDescription></div></div></CardHeader>
      <CardContent className="grid min-w-0 gap-4 lg:grid-cols-2 lg:items-start">
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          {assets.length ? <select value={analysisAssetId} onChange={(event) => setAnalysisAssetId(event.target.value)} className="h-9 rounded-lg border bg-background px-2 text-sm text-foreground sm:col-span-2" aria-label="Creative asset for inference">{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select> : null}
          <Field className="min-w-0 sm:col-span-2"><FieldLabel>Hook retention curve JSON</FieldLabel><Textarea aria-label="Hook retention curve JSON" value={hookCurveJson} onChange={(event) => setHookCurveJson(event.target.value)} rows={2} className="min-w-0 max-w-full break-all font-mono text-xs" /></Field>
          <div className="grid gap-2 sm:col-span-2 sm:grid-cols-3"><Input aria-label="Frequency" type="number" min="0" step="0.1" value={frequency} onChange={(event) => setFrequency(Number(event.target.value))} /><Input aria-label="Previous ROAS" type="number" min="0" step="0.1" value={previousRoas} onChange={(event) => setPreviousRoas(Number(event.target.value))} /><Input aria-label="Current ROAS" type="number" min="0" step="0.1" value={currentRoas} onChange={(event) => setCurrentRoas(Number(event.target.value))} /></div>
          <div className="grid gap-2 sm:col-span-2 sm:grid-cols-3"><Input aria-label="BPM" type="number" min="0" value={bpm} onChange={(event) => setBpm(Number(event.target.value))} /><Input aria-label="Speech ratio" type="number" min="0" max="1" step="0.05" value={speechRatio} onChange={(event) => setSpeechRatio(Number(event.target.value))} /><Input aria-label="Audio energy" type="number" min="0" max="1" step="0.05" value={energy} onChange={(event) => setEnergy(Number(event.target.value))} /></div>
          <Field className="sm:col-span-2"><FieldLabel>Transcript or spoken copy (optional)</FieldLabel><Textarea aria-label="Transcript or spoken copy" value={elementTranscript} onChange={(event) => setElementTranscript(event.target.value)} rows={2} placeholder="Paste the observed transcript" /></Field>
          <Field className="sm:col-span-2"><FieldLabel>Detected labels (optional, comma separated)</FieldLabel><Input aria-label="Detected labels" value={detectedLabels} onChange={(event) => setDetectedLabels(event.target.value)} placeholder="product, person, packaging" /></Field>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground sm:col-span-2"><label className="flex items-center gap-2"><input type="checkbox" checked={hasFace} onChange={(event) => setHasFace(event.target.checked)} />Face visible</label><label className="flex items-center gap-2"><input type="checkbox" checked={hasTextOverlay} onChange={(event) => setHasTextOverlay(event.target.checked)} />Text overlay visible</label><label className="flex items-center gap-2"><input type="checkbox" checked={hasCta} onChange={(event) => setHasCta(event.target.checked)} />CTA visible</label></div>
          <Button className="min-w-0 w-full" type="button" variant="outline" onClick={runHookAnalysis}>Analyze first 3s</Button>
          <Button className="min-w-0 w-full" type="button" variant="outline" onClick={() => void runAnalysis({ analysis: "elements", assetId: analysisAssetId || undefined, transcript: elementTranscript || undefined, detectedLabels: detectedLabels.split(",").map((item) => item.trim()).filter(Boolean), hasFace, hasTextOverlay, hasCta }, "Element tags")}>Tag creative elements</Button>
          <Button className="min-w-0 w-full" type="button" variant="outline" onClick={() => void runAnalysis({ analysis: "audio", assetId: analysisAssetId || undefined, bpm, transcript: elementTranscript || undefined, speechRatio, energy }, "Audio classification")}>Classify audio</Button>
          <Button className="min-w-0 w-full" type="button" variant="outline" onClick={() => void runAnalysis({ analysis: "fatigue", frequency, previousRoas, currentRoas }, "Fatigue detection")}>Check fatigue</Button>
        </div>
        <div className="grid min-w-0 gap-3">
          <Separator className="lg:hidden" />
          <div><p className="text-sm font-semibold">Performance contribution</p><p className="mt-1 text-xs text-muted-foreground">Paste observed impression, click, and conversion samples; no synthetic metrics are added.</p></div>
          <Field className="min-w-0"><FieldLabel>Copy variants JSON</FieldLabel><Textarea aria-label="Copy variants JSON" value={copyVariantsJson} onChange={(event) => setCopyVariantsJson(event.target.value)} rows={4} className="min-w-0 max-w-full break-all font-mono text-xs" /></Field>
          <Button className="min-w-0 w-full" type="button" variant="outline" onClick={() => runStructuredAnalysis("copy", "variants", copyVariantsJson, "Copy variant contribution")}>Analyze copy contribution</Button>
          <Field className="min-w-0"><FieldLabel>Element performance samples JSON</FieldLabel><Textarea aria-label="Element performance samples JSON" value={elementSamplesJson} onChange={(event) => setElementSamplesJson(event.target.value)} rows={4} className="min-w-0 max-w-full break-all font-mono text-xs" /></Field>
          <Button className="min-w-0 w-full" type="button" variant="outline" onClick={() => runStructuredAnalysis("element_correlation", "samples", elementSamplesJson, "Element performance correlation")}>Correlate element performance</Button>
          <Field className="min-w-0"><FieldLabel>Audio performance samples JSON</FieldLabel><Textarea aria-label="Audio performance samples JSON" value={audioSamplesJson} onChange={(event) => setAudioSamplesJson(event.target.value)} rows={4} className="min-w-0 max-w-full break-all font-mono text-xs" /></Field>
          <Button className="min-w-0 w-full" type="button" variant="outline" onClick={() => runStructuredAnalysis("audio_correlation", "samples", audioSamplesJson, "Audio performance correlation")}>Correlate audio performance</Button>
        </div>
        {error ? <p className="text-sm text-destructive lg:col-span-2">{error}</p> : null}
        {analysis ? <div className="rounded-xl border p-3 text-sm lg:col-span-2"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{analysis.title}</p>{analysis.source ? <Badge variant="outline">{analysis.source}{analysis.model ? ` · ${analysis.model}` : ""}</Badge> : null}</div>{analysis.warning ? <p className="mt-2 text-xs text-muted-foreground">{analysis.warning}</p> : null}<pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">{JSON.stringify(analysis.result, null, 2)}</pre></div> : null}
      </CardContent>
    </Card>
    <Card className="h-fit xl:col-span-2"><CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><div><CardTitle>Winning concept clusters</CardTitle><CardDescription>Clusters are ranked by linked owned ROAS, then CPA and size.</CardDescription></div>{clusterEvidence.source ? <Badge variant="outline">{clusterEvidence.source}{clusterEvidence.model ? ` · ${clusterEvidence.model}` : ""}</Badge> : null}</div></CardHeader><CardContent>{clusterEvidence.warning ? <p className="mb-3 text-xs text-muted-foreground">{clusterEvidence.warning}</p> : null}{clusters.length ? <div className="grid gap-2 md:grid-cols-2">{clusters.slice(0, 8).map((cluster) => <div key={cluster.id} className="flex items-center justify-between rounded-xl border p-3 text-sm"><div><p className="font-medium">{cluster.label}</p><p className="mt-1 text-xs text-muted-foreground">{cluster.size} asset(s) · {cluster.cpa ? `CPA ${cluster.cpa.toFixed(0)}` : "No linked CPA"}</p></div><Badge variant="secondary">{cluster.roas ? `${cluster.roas.toFixed(2)}x ROAS` : "Unranked"}</Badge></div>)}</div> : <p className="text-sm text-muted-foreground">Upload and link assets to see winning clusters.</p>}</CardContent></Card>
  </div>;
}
