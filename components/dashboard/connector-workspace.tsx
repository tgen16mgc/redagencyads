"use client";

import * as React from "react";
import {
  ActivityIcon,
  CableIcon,
  DatabaseBackupIcon,
  ExternalLinkIcon,
  RefreshCwIcon,
} from "lucide-react";
import type {
  BacklogPlatformContract,
  ConnectorContract,
} from "@/lib/connectors";
import { jsonFetch } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function ConnectorWorkspace({ language }: { language: "en" | "vi" }) {
  const isVietnamese = language === "vi";
  const [connectors, setConnectors] = React.useState<ConnectorContract[]>([]);
  const [backlog, setBacklog] = React.useState<BacklogPlatformContract[]>([]);
  const [message, setMessage] = React.useState("");
  const [targetAccounts, setTargetAccounts] = React.useState("");
  const [linkedInB2B, setLinkedInB2B] = React.useState<{
    targetAccounts: Array<{
      targetAccount: string;
      leadGenFormFills: number;
      companyEngagement: number;
      jobTitles: string[];
    }>;
    jobTitles: Array<{
      jobTitle: string;
      leadGenFormFills: number;
      companyEngagement: number;
    }>;
  } | null>(null);
  const [health, setHealth] = React.useState<{
    rowCount: number;
    creativeCount: number;
    latestJob?: {
      platform: string;
      status: string;
      durationMs?: number;
      quality: Array<{ status: string }>;
    };
    sla?: { withinSla: boolean };
  } | null>(null);
  const load = React.useCallback(
    () =>
      Promise.all([
        jsonFetch<{
          connectors: ConnectorContract[];
          backlogPlatforms: BacklogPlatformContract[];
        }>("/api/connectors", { timeoutMs: 8000 }),
        jsonFetch<{ health: typeof health }>("/api/intelligence/health", {
          timeoutMs: 8000,
        }),
      ]).then(([data, healthData]) => {
        setConnectors(data.connectors);
        setBacklog(data.backlogPlatforms);
        setHealth(healthData.health);
      }),
    [],
  );
  React.useEffect(() => {
    void load().catch(() => undefined);
  }, [load]);

  async function backfill(platform: string) {
    setMessage("");
    try {
      const data = await jsonFetch<{
        windows: unknown[];
        succeeded: number;
        failed: number;
      }>("/api/intelligence/backfill", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          platform:
            platform === "youtube_analytics"
              ? "youtube"
              : platform === "linkedin_ads"
                ? "linkedin"
                : platform,
          months: 13,
          execute: true,
        }),
        timeoutMs: 300000,
      });
      setMessage(
        `${data.succeeded}/${data.windows.length} ${isVietnamese ? "cửa sổ backfill hoàn tất" : "backfill windows completed"}${data.failed ? ` · ${data.failed} failed` : ""}.`,
      );
      await load();
    } catch (reason) {
      setMessage(
        reason instanceof Error ? reason.message : "Connector backfill failed.",
      );
    }
  }

  async function sync(
    platform: "google_ads" | "youtube" | "linkedin",
    mode: "incremental" | "full",
  ) {
    setMessage("");
    try {
      const data = await jsonFetch<{
        job: { status: string; rowCount: number };
      }>("/api/intelligence/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ platform, mode }),
        timeoutMs: 300000,
      });
      setMessage(
        `${platform} ${mode}: ${data.job.status} · ${data.job.rowCount} rows.`,
      );
      await load();
    } catch (reason) {
      setMessage(
        reason instanceof Error ? reason.message : "Connector sync failed.",
      );
    }
  }

  async function loadLinkedInB2B() {
    setMessage("");
    try {
      const data = await jsonFetch<{
        targetAccounts: typeof linkedInB2B extends infer _T
          ? Array<{
              targetAccount: string;
              leadGenFormFills: number;
              companyEngagement: number;
              jobTitles: string[];
            }>
          : never;
        jobTitles: Array<{
          jobTitle: string;
          leadGenFormFills: number;
          companyEngagement: number;
        }>;
      }>("/api/connectors/linkedin/b2b", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetAccounts: targetAccounts
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        }),
        timeoutMs: 300000,
      });
      setLinkedInB2B(data);
    } catch (reason) {
      setMessage(
        reason instanceof Error
          ? reason.message
          : "LinkedIn B2B report failed.",
      );
    }
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl border bg-background">
              <CableIcon className="size-4" />
            </span>
            <div>
              <CardTitle>
                {isVietnamese ? "Connections & sync" : "Connections and sync"}
              </CardTitle>
              <CardDescription>
                {isVietnamese
                  ? "Auth → schema → sync → UI với trạng thái thật."
                  : "Auth → schema → sync → UI with truthful states."}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="divide-y rounded-xl border">
            {connectors.map((connector) => (
              <div
                key={connector.id}
                className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{connector.label}</p>
                    <Badge
                      variant={
                        connector.state === "available"
                          ? "success"
                          : "secondary"
                      }
                    >
                      {connector.state.replaceAll("_", " ")}
                    </Badge>
                    <Badge variant="outline">
                      {connector.sync.replaceAll("_", " ")}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {connector.reason}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {connector.capabilities.join(" · ")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {connector.id === "google_ads" ||
                  connector.id === "youtube_analytics" ||
                  connector.id === "ga4_attribution" ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        window.location.href =
                          "/api/connectors/oauth/start?provider=google";
                      }}
                    >
                      <ExternalLinkIcon data-icon="inline-start" />
                      OAuth
                    </Button>
                  ) : connector.id === "linkedin_ads" ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        window.location.href =
                          "/api/connectors/oauth/start?provider=linkedin";
                      }}
                    >
                      <ExternalLinkIcon data-icon="inline-start" />
                      OAuth
                    </Button>
                  ) : null}
                  {connector.id === "google_ads" ||
                  connector.id === "youtube_analytics" ||
                  connector.id === "linkedin_ads" ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          void sync(
                            connector.id === "youtube_analytics"
                              ? "youtube"
                              : connector.id === "linkedin_ads"
                                ? "linkedin"
                                : "google_ads",
                            "incremental",
                          )
                        }
                      >
                        <RefreshCwIcon data-icon="inline-start" />
                        Sync now
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          void sync(
                            connector.id === "youtube_analytics"
                              ? "youtube"
                              : connector.id === "linkedin_ads"
                                ? "linkedin"
                                : "google_ads",
                            "full",
                          )
                        }
                      >
                        Full refresh
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void backfill(connector.id)}
                      >
                        <DatabaseBackupIcon data-icon="inline-start" />
                        13-month backfill
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          {message ? (
            <p className="mt-3 text-sm text-muted-foreground">{message}</p>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>LinkedIn B2B reporting</CardTitle>
          <CardDescription>
            Native company and job-title pivots stay separate from blended
            performance totals.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              aria-label="Target accounts"
              value={targetAccounts}
              onChange={(event) => setTargetAccounts(event.target.value)}
              placeholder="Target account names or URNs, comma separated"
              className="h-9 min-w-0 flex-1 rounded-lg border bg-background px-3 text-sm text-foreground"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadLinkedInB2B()}
            >
              Load B2B report
            </Button>
          </div>
          {linkedInB2B ? (
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl border p-3">
                <p className="text-sm font-semibold">Target accounts</p>
                {linkedInB2B.targetAccounts.slice(0, 8).map((item) => (
                  <div
                    key={item.targetAccount}
                    className="mt-2 flex items-center justify-between gap-3 text-xs"
                  >
                    <span className="truncate">{item.targetAccount}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {item.leadGenFormFills} leads · {item.companyEngagement}{" "}
                      engagements
                    </span>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border p-3">
                <p className="text-sm font-semibold">Job titles</p>
                {linkedInB2B.jobTitles.slice(0, 8).map((item) => (
                  <div
                    key={item.jobTitle}
                    className="mt-2 flex items-center justify-between gap-3 text-xs"
                  >
                    <span className="truncate">{item.jobTitle}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {item.leadGenFormFills} leads · {item.companyEngagement}{" "}
                      engagements
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <ActivityIcon className="size-4" />
            <div>
              <CardTitle>Pipeline health</CardTitle>
              <CardDescription>
                Idempotent rows, latest job, and four-hour SLA.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {health ? (
            <div className="grid gap-3 sm:grid-cols-4">
              <Metric label="Rows" value={health.rowCount.toLocaleString()} />
              <Metric
                label="Creatives"
                value={health.creativeCount.toLocaleString()}
              />
              <Metric
                label="Latest job"
                value={
                  health.latestJob
                    ? `${health.latestJob.platform} · ${health.latestJob.status}`
                    : "—"
                }
              />
              <Metric
                label="SLA"
                value={
                  health.sla?.withinSla
                    ? "Within 4h"
                    : health.latestJob
                      ? "Review"
                      : "—"
                }
                badge
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Loading pipeline health…
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            {isVietnamese ? "Backlog platforms" : "Backlog platforms"}
          </CardTitle>
          <CardDescription>
            X Ads, Pinterest, Snapchat, Reddit, DV360, and The Trade Desk share
            the same connector lifecycle.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {backlog.map((item) => (
            <Badge key={item.id} variant="outline">
              {item.label} · {item.state.replaceAll("_", " ")}
            </Badge>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({
  label,
  value,
  badge,
}: {
  label: string;
  value: string;
  badge?: boolean;
}) {
  return (
    <div className="rounded-xl border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      {badge ? (
        <Badge className="mt-2" variant="secondary">
          {value}
        </Badge>
      ) : (
        <p className="mt-1 text-sm font-semibold tabular-nums">{value}</p>
      )}
    </div>
  );
}
