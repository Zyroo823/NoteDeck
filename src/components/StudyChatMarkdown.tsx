import DOMPurify from "dompurify";
import { Marked, Renderer } from "marked";

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const markdown = new Marked({
  breaks: true,
  renderer: {
    html({ text }) {
      return escapeHtml(text);
    },
    image({ raw }) {
      return escapeHtml(raw);
    },
    link(token) {
      return Renderer.prototype.link.call(this, token)
        .replace(/^<a /, '<a target="_blank" rel="noopener noreferrer" ');
    },
  },
});

export function StudyChatMarkdown({ text, allowLinks = true }: { text: string; allowLinks?: boolean }) {
  const html = DOMPurify.sanitize(markdown.parse(text, { async: false }), {
    ALLOWED_TAGS: ["p", "strong", "em", "ul", "ol", "li", "br", "code", ...(allowLinks ? ["a"] : [])],
    ALLOWED_ATTR: allowLinks ? ["href", "target", "rel", "start"] : ["start"],
    ALLOW_ARIA_ATTR: false,
    ALLOW_DATA_ATTR: false,
  });

  return (
    <div
      className="space-y-2 [&_a]:underline [&_code]:rounded [&_code]:bg-slate-200 [&_code]:px-1 dark:[&_code]:bg-[#0B0E17] [&_ol]:list-decimal [&_ol]:ps-5 [&_ul]:list-disc [&_ul]:ps-5"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
