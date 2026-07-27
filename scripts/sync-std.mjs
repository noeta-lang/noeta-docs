/**
 * Generates the standard-library API reference into `content/docs/` — one page
 * per std module family (`std-math.md` → /std-math) plus the overview at /std —
 * and appends a "Standard library" section to the synced _Sidebar.md. Called
 * from sync-docs.mjs (before sync-para, so the sections land in that order).
 *
 * The source of truth is the toolchain itself: `noeta doc --api` walks the
 * intrinsic registry (the same data the compiler and LSP serve) and emits a
 * schema-versioned docs.json of every module's public items with signatures
 * and doc prose. This script renders that into site pages, so the reference
 * regenerates on every build and cannot drift from the toolchain.
 *
 * The binary is found via $NOETA_BIN, then a sibling `../lang` build, then
 * PATH. Without one (e.g. CI before a release with binary assets exists) the
 * site simply builds without the std section — the para-pages degradation
 * model.
 *
 * Env:
 *   NOETA_BIN — path to the `noeta` binary to generate with
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";

const docsDir = resolve(process.cwd(), "content", "docs");
const MARKER = "<!-- std-reference: appended by scripts/sync-std.mjs -->";

const OVERVIEW_SRC = resolve(process.cwd(), "content-src", "Std.md");
const OVERVIEW_EDIT_URL = "https://github.com/noeta-lang/noeta-docs/edit/main/content-src/Std.md";
const INDEX_MARKER = "<!-- std-index -->";

/** Where the intrinsic doc prose lives — the "fix it here" pointer on every generated page. */
const PROSE_URL = "https://github.com/noeta-lang/noeta/blob/main/crates/noeta-stdlib/src/registry.rs";

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

/** A namespace like `std.fs.FileHandle` is a type page; `std.http.client` a submodule. */
const isTypeNamespace = (ns) => ns.split(".").some((seg) => /^[A-Z]/.test(seg));

const publicItems = (mod) => mod.items.filter((i) => i.public);

function renderItems(mod) {
  const out = [];
  for (const item of publicItems(mod)) {
    out.push(`### \`${item.name}\``, "", "```noeta", item.signature, "```", "");
    if (item.doc) out.push(item.doc.trim(), "");
  }
  return out;
}

/** One page per family: `# std.http`, every namespace in the family as a
 *  section (submodules first, then types), each item as signature + prose. */
function buildFamilyPage(family, mods) {
  const fnCount = mods.reduce((n, m) => n + publicItems(m).length, 0);
  const single = mods.length === 1;

  const lines = [
    `# std.${family}`,
    "",
    "> [!NOTE]",
    `> This page is generated from the toolchain's registered API by \`noeta doc --api\` — see the`,
    `> [reference overview](Std). The doc prose lives beside the intrinsics in [\`noeta-stdlib\`](${PROSE_URL}).`,
    "",
    single
      ? `API reference for the \`std.${family}\` module — ${fnCount} public items, with the signatures the compiler enforces.`
      : `API reference for the \`std.${family}\` family — ${fnCount} public items across ${mods
          .map((m) => `\`${m.namespace}\``)
          .join(", ")}, with the signatures the compiler enforces.`,
    "",
  ];

  for (const mod of mods) {
    if (!single) lines.push(`## \`${mod.namespace}\``, "");
    if (mod.doc) lines.push(mod.doc.trim(), "");
    lines.push(...renderItems(mod));
  }
  return lines.join("\n").trimEnd() + "\n";
}

/** The overview: the content-src template with the generated module index
 *  table in place of its marker. */
function buildOverviewPage(families) {
  const template = readFileSync(OVERVIEW_SRC, "utf-8");
  const table = [
    "| Module | Public items |",
    "|---|---|",
    ...[...families.entries()].map(([family, mods]) => {
      const fnCount = mods.reduce((n, m) => n + publicItems(m).length, 0);
      return `| [\`std.${family}\`](std-${family}) | ${fnCount} |`;
    }),
  ].join("\n");
  return template.replace(INDEX_MARKER, table);
}

/** Appends (or replaces, from its marker) the "Standard library" sidebar
 *  section. Runs before sync-para, whose own append lands after this one. */
function appendSidebarSection(families) {
  const sidebarPath = resolve(docsDir, "_Sidebar.md");
  if (!existsSync(sidebarPath)) return;
  let content = readFileSync(sidebarPath, "utf-8");
  const at = content.indexOf(MARKER);
  if (at >= 0) content = content.slice(0, at);
  // The modules nest under the overview link (indent = sidebar child), so the
  // whole reference collapses to one row unless the reader is inside it.
  const section = [
    MARKER,
    "",
    "**Standard library**",
    "- [Overview](Std)",
    ...[...families.keys()].map((f) => `  - [std.${f}](std-${f})`),
  ].join("\n");
  writeFileSync(sidebarPath, content.trimEnd() + "\n\n" + section + "\n");
}

export function syncStdDocs() {
  const bin = findNoeta();
  if (!bin) {
    console.warn("[sync-std] WARNING: no `noeta` binary found ($NOETA_BIN, ../lang/target, PATH); building without the std reference");
    return;
  }

  const tmp = resolve(process.cwd(), "content", "std-api.tmp");
  rmSync(tmp, { recursive: true, force: true });
  execFileSync(bin, ["doc", "--api", "--out", tmp], { stdio: ["ignore", "pipe", "inherit"] });
  const data = JSON.parse(readFileSync(join(tmp, "docs.json"), "utf-8"));
  rmSync(tmp, { recursive: true, force: true });
  if (data.schema !== 1) {
    console.warn(`[sync-std] WARNING: docs.json schema ${data.schema} (expected 1); building without the std reference`);
    return;
  }

  // Group namespaces into families by second segment: std.http.client,
  // std.http.server, and std.http.Request all render on the std-http page.
  const families = new Map();
  for (const mod of data.modules) {
    const parts = mod.namespace.split(".");
    if (parts[0] !== "std" || parts.length < 2) continue;
    const family = parts[1];
    if (!families.has(family)) families.set(family, []);
    families.get(family).push(mod);
  }
  for (const mods of families.values()) {
    mods.sort((a, b) =>
      isTypeNamespace(a.namespace) - isTypeNamespace(b.namespace) || a.namespace.localeCompare(b.namespace),
    );
  }
  const sorted = new Map([...families.entries()].sort(([a], [b]) => a.localeCompare(b)));

  for (const [family, mods] of sorted) {
    writeFileSync(join(docsDir, `std-${family}.md`), buildFamilyPage(family, mods));
  }
  writeFileSync(join(docsDir, "Std.md"), buildOverviewPage(sorted));
  appendSidebarSection(sorted);

  const manifest = [...sorted.keys()].map((f) => ({ slug: `std-${f}`, edit: PROSE_URL }));
  manifest.push({ slug: "std", edit: OVERVIEW_EDIT_URL });
  writeFileSync(join(docsDir, "_std-modules.json"), JSON.stringify(manifest, null, 2) + "\n");

  const total = data.modules.reduce((n, m) => n + publicItems(m).length, 0);
  console.log(`[sync-std] Generated the std reference with ${bin}: ${sorted.size} module pages, ${total} public items`);
}
