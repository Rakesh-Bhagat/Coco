import { createRenderer } from "markdansi";
import { createHighlighter, type BundledLanguage } from "shiki";

const THEME = "github-dark";
const LANGS: BundledLanguage[] = [
  "typescript",
  "tsx",
  "javascript",
  "jsx",
  "json",
  "bash",
  "python",
  "yaml",
  "markdown",
  "html",
  "css",
  "cpp",
  "c",
];
const SUPPORTED = new Set<string>(LANGS);
const ALIASES: Record<string, string> = {
  ts: "typescript",
  js: "javascript",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  py: "python",
  yml: "yaml",
  md: "markdown",
  cpp: "cpp",
  cplusplus: "cpp",
  cc: "cpp",
};

// Top-level await: the highlighter loads once at startup.
const shiki = await createHighlighter({ themes: [THEME], langs: LANGS });

function highlight(code: string, language?: string): string {
  if (!language) return code;
  const key = language.toLowerCase();
  const lang = ALIASES[key] ?? key;
  if (!SUPPORTED.has(lang)) return code; // unknown language: plain text

  const { tokens } = shiki.codeToTokens(code, {
    lang: lang as BundledLanguage,
    theme: THEME,
  });
  return tokens
    .map((line) =>
      line
        .map((t) => {
          if (!t.color) return t.content;
          const r = parseInt(t.color.slice(1, 3), 16);
          const g = parseInt(t.color.slice(3, 5), 16);
          const b = parseInt(t.color.slice(5, 7), 16);
          return `\u001b[38;2;${r};${g};${b}m${t.content}\u001b[39m`;
        })
        .join(""),
    )
    .join("\n");
}

export const renderMarkdown = (md: string) =>
  createRenderer({
    width: process.stdout.columns ?? 80,
    highlighter: highlight,
    codeBox: false,
  })(md);
