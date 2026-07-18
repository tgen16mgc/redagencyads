import * as React from "react";
import { parseChatMarkdown } from "@/lib/ai/chat-markdown";

function InlineMarkdown({ children }: { children: string }) {
  const parts = children.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

export function ContextChatMarkdown({ content }: { content: string }) {
  const blocks = parseChatMarkdown(content);
  return (
    <div className="context-chat-markdown">
      {blocks.map((block, blockIndex) => {
        if (block.type === "heading") {
          return <h3 key={blockIndex} data-level={block.level}><InlineMarkdown>{block.content}</InlineMarkdown></h3>;
        }
        if (block.type === "divider") return <hr key={blockIndex} />;
        if (block.type === "unordered-list") {
          return <ul key={blockIndex}>{block.items.map((item, itemIndex) => <li key={itemIndex}><InlineMarkdown>{item}</InlineMarkdown></li>)}</ul>;
        }
        if (block.type === "ordered-list") {
          return <ol key={blockIndex}>{block.items.map((item, itemIndex) => <li key={itemIndex}><InlineMarkdown>{item}</InlineMarkdown></li>)}</ol>;
        }
        if (block.type === "table") {
          return (
            <div key={blockIndex} className="context-chat-table-wrap">
              <table>
                <thead>
                  <tr>{block.headers.map((header, cellIndex) => <th key={cellIndex} scope="col"><InlineMarkdown>{header}</InlineMarkdown></th>)}</tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}><InlineMarkdown>{cell}</InlineMarkdown></td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return (
          <p key={blockIndex}>
            {block.lines.map((line, lineIndex) => (
              <React.Fragment key={lineIndex}>
                {lineIndex ? <br /> : null}
                <InlineMarkdown>{line}</InlineMarkdown>
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
