const SCRIPT_ELEMENT = /<script\b[\s\S]*?(?:<\/script\s*>|$)/gi;
const SCRIPT_CLOSE_TAG = /<\/script\s*>/gi;
const BLOCKED_ELEMENT_TAG = /<\/?(?:object|embed)\b[^>]*>?/gi;
const BLOCKED_ATTRIBUTE = /[\s\/](?:on\w+|srcdoc)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi;
const URL_ATTRIBUTE = /([\s\/])((?:href|src|action|formaction|data|xlink:href)\s*=\s*)("[^"]*"|'[^']*'|[^\s>]*)/gi;
const DANGEROUS_SCHEME = /^(?:javascript|vbscript|data|blob|file):/;
const IFRAME_SRC = /<iframe\b[^>]*\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i;

function decodedCodePoint(value: number): string {
  return Number.isFinite(value) && value >= 0 && value <= 0x10ffff ? String.fromCodePoint(value) : "�";
}

function hasDangerousScheme(rawValue: string): boolean {
  const unquoted = rawValue.replace(/^["']|["']$/g, "");
  const decoded = unquoted
    .replace(/&#x([0-9a-f]+);?/gi, (_match, hex: string) => decodedCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_match, dec: string) => decodedCodePoint(parseInt(dec, 10)))
    .replace(/&colon;/gi, ":")
    .replace(/&tab;/gi, "\t")
    .replace(/&newline;/gi, "\n");
  const compact = decoded.replace(/[\u0000-\u0020\u00a0]+/g, "").toLowerCase();
  return DANGEROUS_SCHEME.test(compact);
}

function sanitizePass(html: string): string {
  return html
    .replace(SCRIPT_ELEMENT, "")
    .replace(SCRIPT_CLOSE_TAG, "")
    .replace(BLOCKED_ELEMENT_TAG, "")
    .replace(BLOCKED_ATTRIBUTE, "")
    .replace(URL_ATTRIBUTE, (match, prefix: string, _attribute: string, value: string) =>
      hasDangerousScheme(value) ? prefix : match,
    );
}

export function sanitizeAdPreviewHtml(html: string): string {
  let current = html;
  for (let pass = 0; pass < 10; pass += 1) {
    const next = sanitizePass(current);
    if (next === current) return current;
    current = next;
  }
  return "";
}

export function extractMetaAdPreviewUrl(html: string): string | null {
  const match = IFRAME_SRC.exec(html);
  const rawValue = match?.[1] || match?.[2] || match?.[3];
  if (!rawValue) return null;

  const decoded = rawValue
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .trim();
  const absolute = decoded.startsWith("//") ? `https:${decoded}` : decoded;

  try {
    const url = new URL(absolute);
    const hostname = url.hostname.toLowerCase();
    const isFacebookHost = hostname === "facebook.com" || hostname.endsWith(".facebook.com");
    if (url.protocol !== "https:" || !isFacebookHost || !url.pathname.startsWith("/ads/api/preview")) return null;
    return url.toString();
  } catch {
    return null;
  }
}
