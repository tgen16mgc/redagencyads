"use client";

import * as React from "react";
import { ImageOffIcon } from "lucide-react";
import { metaPreviewImageSrc, resolveCreativePreview } from "@/lib/creative-comparison";
import { sanitizeAdPreviewHtml } from "@/lib/ad-preview-html";
import type { DashboardReport, InterfaceLanguage, NormalizedRow } from "@/lib/types";
import { cn } from "@/lib/utils";

export function MetaCreativeCover({ report, row, className }: { report: DashboardReport; row: NormalizedRow; className?: string }) {
  const preview = resolveCreativePreview(report, row);
  const source = preview?.previewImageUrl ? metaPreviewImageSrc(preview.previewImageUrl) : "";
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => setFailed(false), [source]);

  return (
    <div className={cn("relative flex items-center justify-center overflow-hidden rounded-xl bg-secondary", className)}>
      {source && !failed ? (
        <img src={source} alt={`${row.name} Meta ad cover`} className="size-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-2 p-3 text-center text-muted-foreground">
          <ImageOffIcon className="size-5" />
          <span className="text-[10px] leading-4">Meta cover unavailable</span>
        </div>
      )}
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2 pb-2 pt-6 text-[9px] font-medium uppercase text-white/85">
        {preview?.previewImageUrl ? "Meta creative" : "No cover returned"}
      </span>
    </div>
  );
}

export function MetaCreativeFocusPreview({ report, row, language }: { report: DashboardReport; row: NormalizedRow; language: InterfaceLanguage }) {
  const preview = resolveCreativePreview(report, row);
  const isVietnamese = language === "vi";
  const source = preview?.previewImageUrl ? metaPreviewImageSrc(preview.previewImageUrl) : "";
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => setFailed(false), [source]);

  if (preview?.previewHtml) {
    return (
      <div className="max-h-[520px] overflow-y-auto overflow-x-hidden rounded-xl border border-border bg-white p-2 shadow-sm [&_iframe]:!mx-auto [&_iframe]:!block [&_iframe]:!max-w-full [&_iframe]:!border-0" data-meta-creative-preview>
        <div dangerouslySetInnerHTML={{ __html: sanitizeAdPreviewHtml(preview.previewHtml) }} />
      </div>
    );
  }

  if (source && !failed) {
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-black/5" data-meta-creative-preview>
        <img src={source} alt={`${row.name} Meta ad preview`} className="max-h-[520px] w-full object-contain" onError={() => setFailed(true)} />
      </div>
    );
  }

  return (
    <div className="flex min-h-52 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-secondary/25 p-6 text-center text-muted-foreground" data-meta-creative-preview-unavailable>
      <ImageOffIcon className="size-6" />
      <div>
        <div className="text-sm font-medium text-foreground">{isVietnamese ? "Meta chưa trả về preview" : "Meta did not return a preview"}</div>
        <p className="mt-1 text-xs leading-5">{isVietnamese ? "Số liệu hiệu quả vẫn là dữ liệu thật; media không được thay bằng mockup." : "Performance metrics remain real; missing media is not replaced with a mockup."}</p>
      </div>
    </div>
  );
}
