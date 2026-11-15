import { tokenizeSafeMarkdown } from "@/src/lib/studyLogic";

interface SafeMarkdownTextProps {
  text: string;
}

export function SafeMarkdownText({ text }: SafeMarkdownTextProps) {
  const tokens = tokenizeSafeMarkdown(text);

  return (
    <>
      {tokens.map((token, idx) => {
        if (token.kind === "bold") {
          return (
            <strong key={idx} className="font-semibold text-slate-900 dark:text-white">
              {token.value}
            </strong>
          );
        }
        if (token.kind === "code") {
          return (
            <code
              key={idx}
              className="rounded bg-slate-200 px-1.5 py-0.5 font-mono-nums text-[0.9em] text-slate-900 dark:bg-[#1C2336] dark:text-[#2DD4BF]"
            >
              {token.value}
            </code>
          );
        }
        return <span key={idx}>{token.value}</span>;
      })}
    </>
  );
}
