/**
 * Generates the diagnostics reference into `content/docs/Diagnostics.md` — the
 * `E0xxx` catalog every rendered diagnostic's code refers to — and adds it to
 * the synced _Sidebar.md's language-reference section.
 *
 * The source of truth is the toolchain itself: `noeta explain --all --format
 * json` emits a schema-versioned catalog straight from the compiler's own
 * explanation store (`DiagnosticCode::explain`), the same text `noeta explain
 * E0059` prints in a terminal and the MCP `explain_diagnostic` tool serves to
 * an agent. Rendering it here means the page regenerates on every build and
 * cannot drift from the codes it describes — a new diagnostic does not compile
 * in `lang` until it has an entry.
 *
 * The binary is found via $NOETA_BIN, then a sibling `../lang` build, then
 * PATH. Without one the site simply builds without the page — the same
 * degradation model as the std and para references.
 *
 * Env:
 *   NOETA_BIN — path to the `noeta` binary to generate with
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";

const docsDir = resolve(process.cwd(), "content", "docs");
const MARKER = "<!-- diagnostics-reference: appended by scripts/sync-diagnostics.mjs -->";

/** Where the explanation prose lives — the "fix it here" pointer on the page. */
const PROSE_URL =
  "https://github.com/noeta-lang/noeta/blob/main/crates/noeta-diagnostics/src/explain.rs";

function findNoeta() {
  const candidates = [
    process.env.NOETA_BIN,
    resolve(process.cwd(), "..", "lang", "target", "release", "noeta"),
    resolve(process.cwd(), "..", "lang", "target", "debug", "noeta"),
  ].filter(Boolean);
  for (const c of candidates) if (existsSync(c)) return c;
  try {
    execFileSync("noeta", ["--version"], { stdio: "ignore" });
    return "noeta";
  } catch {
    return null;
  }
}

/** Markdown-escape a cell: the prose carries `|` in type unions like `A | B`. */
const cell = (s) => s.replace(/\|/g, "\\|");

/** The GitHub-style heading slug for a code's block, for the index links. */
const anchor = (e) =>
  `${e.code} — ${e.title}`
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s/g, "-");

/** One group: a scannable index table, then a block per code. The table is the
 *  "which one is mine" pass; the blocks carry the fix and give every code a
 *  linkable anchor, so a diagnostic's code can be deep-linked. */
function renderGroup(group, entries) {
  const lines = [`## ${group}`, "", "| Code | | |", "|---|---|---|"];
  for (const e of entries) {
    const warn = e.severity === "warning" ? " *(warning)*" : "";
    lines.push(
      `| [\`${e.code}\`](#${anchor(e)}) | ${cell(e.title)}${warn} | ${cell(e.summary)} |`,
    );
  }
  lines.push("");
  for (const e of entries) {
    lines.push(`### \`${e.code}\` — ${e.title}`, "");
    if (e.severity === "warning") {
      lines.push("> [!NOTE]", "> A **warning**: this prints, but does not fail a build.", "");
    }
    lines.push(e.summary, "");
    if (e.detail) lines.push(e.detail, "");
    if (e.docs) lines.push(`→ [${e.docs.replace(/-/g, " ")}](${e.docs})`, "");
  }
  return lines;
}

function buildPage(data) {
  const warnings = data.diagnostics.filter((d) => d.severity === "warning");
  const lines = [
    "# Diagnostics — the `E0xxx` catalog",
    "",
    "> [!NOTE]",
    "> This page is generated from the toolchain's own explanation catalog by",
    "> `noeta explain --all` — the same text `noeta explain E0059` prints in your terminal.",
    `> The prose lives beside the codes in [\`noeta-diagnostics\`](${PROSE_URL}).`,
    "",
    `Every diagnostic the toolchain reports carries a stable code — ${data.diagnostics.length} of them. ` +
      "A code is assigned once and never reused or renumbered, so it means the same thing in every " +
      "release, in a diagnostic, in a conformance case, and in a search.",
    "",
    "**Look one up without leaving the terminal:** `noeta explain E0059`. An agent asks the same " +
      "catalog through `noeta mcp`'s `explain_diagnostic` tool.",
    "",
    "## Reading one",
    "",
    "Every stage of the compiler emits diagnostics through one renderer, so they all have the same " +
      "shape — code, message, the span under a caret, and often a `help:` line carrying the fix:",
    "",
    "```text",
    "[E0059] Error: `base` is already bound in an enclosing scope",
    "   ╭─[ app.noe:4:12 ]",
    "   │",
    " 4 │     scaled = fn(base) => base * 2",
    "   │                 ──┬─",
    "   │                   ╰── this binder reuses a name that is already in scope",
    "   │",
    "   help: rename this binder — one name means one thing per scope stack",
    "───╯",
    "```",
    "",
    warnings.length
      ? `${warnings.length} codes are **warnings** — they print, but do not fail a build: ` +
        warnings.map((w) => `\`${w.code}\``).join(", ") +
        ". Everything else is an error."
      : "Every code is an error.",
    "",
    "Most codes are decided before your program runs, so [`noeta check`](The-CLI#noeta-check) " +
      "reports them without executing anything.",
    "",
  ];

  for (const group of data.groups) {
    const entries = data.diagnostics.filter((d) => d.group === group);
    if (entries.length) lines.push(...renderGroup(group, entries));
  }

  lines.push(
    "## See also",
    "",
    "- [The CLI](The-CLI#noeta-check) — `noeta check` reports every diagnostic without running anything; `--format json` emits them machine-readably.",
    "- [Editor & AI Tooling](Editor-and-AI-Tooling) — the language server surfaces these live, and `noeta mcp`'s `explain_diagnostic` serves this catalog plus the CI-tested programs that trigger each code.",
    "- [Architecture & Pipeline](Architecture-and-Pipeline#diagnostics-as-data) — why every diagnostic is a typed value with one renderer.",
    "",
  );
  return lines.join("\n").trimEnd() + "\n";
}

/** Appends (or replaces, from its marker) the Diagnostics sidebar row. */
function appendSidebarSection() {
  const sidebarPath = resolve(docsDir, "_Sidebar.md");
  if (!existsSync(sidebarPath)) return;
  let content = readFileSync(sidebarPath, "utf-8");
  const at = content.indexOf(MARKER);
  if (at >= 0) content = content.slice(0, at);
  writeFileSync(
    sidebarPath,
    `${content.trimEnd()}\n\n${MARKER}\n**Diagnostics**\n- [The \`E0xxx\` catalog](Diagnostics)\n`,
  );
}

export function syncDiagnostics() {
  const bin = findNoeta();
  if (!bin) {
    console.warn("[sync-diagnostics] No noeta binary found; building without the diagnostics reference");
    return;
  }
  const raw = execFileSync(bin, ["explain", "--all", "--format", "json"], {
    stdio: ["ignore", "pipe", "inherit"],
    maxBuffer: 16 * 1024 * 1024,
  });
  const data = JSON.parse(raw.toString("utf-8"));
  if (data.schema !== 1) {
    console.warn(
      `[sync-diagnostics] WARNING: catalog schema ${data.schema} (expected 1); building without the diagnostics reference`,
    );
    return;
  }

  writeFileSync(join(docsDir, "Diagnostics.md"), buildPage(data));
  appendSidebarSection();
  console.log(
    `[sync-diagnostics] Generated the diagnostics reference with ${bin}: ${data.diagnostics.length} codes across ${data.groups.length} groups`,
  );
}
