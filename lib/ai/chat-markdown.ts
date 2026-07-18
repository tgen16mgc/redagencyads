export type ChatMarkdownBlock =
  | { type: "heading"; level: 1 | 2 | 3; content: string }
  | { type: "paragraph"; lines: string[] }
  | { type: "unordered-list"; items: string[] }
  | { type: "ordered-list"; items: string[] }
  | { type: "divider" }
  | { type: "table"; headers: string[]; rows: string[][] };

const HEADING_PATTERN = /^(#{1,3})\s+(.+)$/;
const BOLD_TITLE_PATTERN = /^\*\*([^*]+)\*\*$/;
const UNORDERED_LIST_PATTERN = /^[-*]\s+(.+)$/;
const ORDERED_LIST_PATTERN = /^\d+[.)]\s+(.+)$/;
const DIVIDER_PATTERN = /^\s*(?:-{3,}|_{3,}|\*{3,})\s*$/;

function splitTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableSeparator(line: string) {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, "")));
}

function isBlockStart(lines: string[], index: number) {
  const line = lines[index]?.trim() || "";
  if (!line) return true;
  if (HEADING_PATTERN.test(line) || UNORDERED_LIST_PATTERN.test(line) || ORDERED_LIST_PATTERN.test(line) || DIVIDER_PATTERN.test(line)) {
    return true;
  }
  return line.includes("|") && isTableSeparator(lines[index + 1] || "");
}

export function parseChatMarkdown(input: string): ChatMarkdownBlock[] {
  const lines = input.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ChatMarkdownBlock[] = [];

  for (let index = 0; index < lines.length;) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }

    const heading = line.match(HEADING_PATTERN);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length as 1 | 2 | 3, content: heading[2].trim() });
      index += 1;
      continue;
    }

    const boldTitle = line.match(BOLD_TITLE_PATTERN);
    if (boldTitle) {
      blocks.push({ type: "heading", level: 1, content: boldTitle[1].trim() });
      index += 1;
      continue;
    }

    if (DIVIDER_PATTERN.test(line)) {
      blocks.push({ type: "divider" });
      index += 1;
      continue;
    }

    if (line.includes("|") && isTableSeparator(lines[index + 1] || "")) {
      const headers = splitTableRow(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].trim().includes("|")) {
        const cells = splitTableRow(lines[index]);
        rows.push(headers.map((_, cellIndex) => cells[cellIndex] || ""));
        index += 1;
      }
      blocks.push({ type: "table", headers, rows });
      continue;
    }

    const unordered = line.match(UNORDERED_LIST_PATTERN);
    if (unordered) {
      const items: string[] = [];
      while (index < lines.length) {
        const item = lines[index].trim().match(UNORDERED_LIST_PATTERN);
        if (!item) break;
        items.push(item[1].trim());
        index += 1;
      }
      blocks.push({ type: "unordered-list", items });
      continue;
    }

    const ordered = line.match(ORDERED_LIST_PATTERN);
    if (ordered) {
      const items: string[] = [];
      while (index < lines.length) {
        const item = lines[index].trim().match(ORDERED_LIST_PATTERN);
        if (!item) break;
        items.push(item[1].trim());
        index += 1;
      }
      blocks.push({ type: "ordered-list", items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines, index)) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }
    if (paragraphLines.length === 0) {
      paragraphLines.push(line);
      index += 1;
    }
    blocks.push({ type: "paragraph", lines: paragraphLines });
  }

  return blocks;
}
