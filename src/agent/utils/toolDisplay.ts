import { stdout } from "process";
import { bold, dim } from "./format.js";

/**
 * Renders the "● Label(detail)" header for a tool call and lets the user
 * expand / collapse it in place (ctrl+o) when the detail doesn't fit on one line.
 *
 * To redraw in place we need to know how many terminal rows have been printed
 * since the header started, so anything printed below it while it is still
 * "live" must go through `below()` / `track()`.
 */

type Current = {
  label: string;
  full: string;
  expanded: boolean;
  below: string[];
};

/** Text currently sitting on an unfinished line (an active prompt + what has been typed). */
let pending: (() => string) | null = null;
export function setPending(fn: (() => string) | null) {
  pending = fn;
}

let current: Current | null = null;

const ANSI = /\x1b\[[0-9;]*m/g;
const cols = () => stdout.columns || 100;
const visLen = (s: string) => s.replace(ANSI, "").length;

/** Terminal rows the cursor moves down after printing `text` (assumes it starts at column 0). */
function rows(text: string): number {
  const c = cols();
  const parts = text.split("\n");
  let n = 0;
  parts.forEach((p, i) => {
    const len = visLen(p);
    if (i < parts.length - 1) n += Math.max(1, Math.ceil(len / c));
    else n += Math.floor(len / c);
  });
  return n;
}

const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

function maxDetail(label: string, hintLen: number) {
  return Math.max(20, cols() - label.length - 6 - hintLen);
}

function isTruncated(c: Current): boolean {
  const flat = oneLine(c.full);
  return flat !== c.full.trim() || flat.length > maxDetail(c.label, 0);
}

function render(c: Current): string {
  const open = `\n${bold("●")} ${bold(c.label)}${dim("(")}`;
  const close = dim(")");
  if (c.expanded) {
    const body = c.full.trim().replace(/\t/g, "  ").replace(/\n/g, "\n  ");
    return `${open}${body}${close}\n${dim("  ctrl+o to collapse")}\n`;
  }
  let detail = oneLine(c.full);
  let hint = "";
  if (isTruncated(c)) {
    const hintText = " ctrl+o to expand";
    const max = maxDetail(c.label, hintText.length);
    if (detail.length > max) detail = detail.slice(0, max - 1) + "…";
    hint = dim(hintText);
  }
  return `${open}${detail}${close}${hint}\n`;
}

/** Print a tool header and make it the live, toggleable one. */
export function showTool(label: string, full: string) {
  current = { label, full, expanded: false, below: [] };
  stdout.write(render(current));
}

/** Print text under the live header (must end with a newline unless it's a prompt). */
export function below(text: string) {
  stdout.write(text);
  track(text);
}

/** Record output that was printed elsewhere (e.g. the echoed newline after an answered prompt). */
export function track(text: string) {
  current?.below.push(text);
}

/** The header is no longer redrawable; call before printing anything unrelated. */
export function end() {
  current = null;
}

/** Toggle expanded/collapsed. Returns true if the screen was redrawn. */
export function toggleExpand(): boolean {
  const c = current;
  if (!c || !stdout.isTTY) return false;
  if (!c.expanded && !isTruncated(c)) return false;

  // Cursor sits on the row after everything printed since the header started.
  const tail = c.below.join("") + (pending?.() ?? "");
  const up = rows(render(c) + tail);
  // If it has scrolled off screen we can't reach it.
  if (up >= (stdout.rows || 24) - 1) return false;

  c.expanded = !c.expanded;
  const move = up > 0 ? `\x1b[${up}A` : "";
  stdout.write(`${move}\r\x1b[J${render(c)}${tail}`);
  return true;
}
