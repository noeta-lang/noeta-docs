/**
 * Syncs the para-* library READMEs into `content/docs/` — one page per library
 * (`para-cli.md` → /para-cli) — and appends a "Para libraries" section to the
 * synced _Sidebar.md so nav, prev/next paging, and llms.txt pick the pages up
 * through the normal machinery. Called from sync-docs.mjs after the docs sync.
 *
 * Two sources, mirroring sync-docs:
 *   1. A local sibling checkout of the para workspace (`../para`, or
 *      $PARA_LIBS_LOCAL) — every `para-*` directory with a README.md.
 *   2. The GitHub org: every unarchived `para-*` repo, README fetched raw. A
 *      repo without a README (not yet pushed) is skipped with a warning.
 *
 * Each page gets a note linking the GitHub repo and the package's registry
 * page (the API reference lives there), and relative README links are
 * rewritten to absolute GitHub URLs. A `_para-libs.json` manifest rides along
 * for the pages that need to know a doc came from a library repo (edit links).
 *
 * Env:
 *   PARA_LIBS_LOCAL — path to the para workspace (default: ../para)
 *   PARA_LIBS_ORG   — GitHub org for the remote fallback (default noeta-lang)
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { toDocSlug } from "./doc-links.mjs";

const ORG = process.env.PARA_LIBS_ORG ?? "noeta-lang";
const LOCAL = process.env.PARA_LIBS_LOCAL ?? resolve(process.cwd(), "..", "para");
const REGISTRY = "https://registry.noeta.dev";

const docsDir = resolve(process.cwd(), "content", "docs");
const MARKER = "<!-- para-libraries: appended by scripts/sync-para.mjs -->";

/** The hand-written overview page (this repo's content-src/), synced in with a
 *  generated library index replacing its <!-- para-index --> marker. */
const OVERVIEW_SRC = resolve(process.cwd(), "content-src", "Para-Libraries.md");
const OVERVIEW_EDIT_URL = "https://github.com/noeta-lang/noeta-docs/edit/main/content-src/Para-Libraries.md";
const INDEX_MARKER = "<!-- para-index -->";

/** `name = "para/cli"` from a noeta.toml, or a derivation from the repo name
 *  (`para-aether-db` → `para/aether_db`) when the manifest isn't readable. */
function packageName(repo, toml) {
  const m = toml?.match(/^\s*name\s*=\s*"([^"]+)"/m);
  if (m) return m[1];
  return `para/${repo.replace(/^para-/, "").replace(/-/g, "_")}`;
}

/** Rewrites relative link/image targets in README prose to absolute GitHub
 *  URLs (blob/ for links, raw for images). Without this, targets like
 *  `LICENSE-APACHE` would be misread as doc cross-links by the site's own
 *  rewriter, and `examples/demo` would 404 on the docs site.
 *
 *  Fenced code blocks are skipped wholesale. Inline code spans are protected
 *  with placeholders rather than split on (the way doc-links' rewriteProse
 *  does), because README link text routinely contains code spans —
 *  [`examples/demo/`](examples/demo) — and splitting would hide the link. */
function absolutizeReadmeLinks(md, repo, branch) {
  const blob = `https://github.com/${ORG}/${repo}/blob/${branch}/`;
  const raw = `https://raw.githubusercontent.com/${ORG}/${repo}/${branch}/`;

  const rewriteLine = (line) => {
    const spans = [];
    const protectedLine = line.replace(/`+[^`]*`+/g, (s) => `\u0000${spans.push(s) - 1}\u0000`);
    const out = protectedLine.replace(/(!?)\[([^\]]*)\]\(([^)\s]+)\)/g, (full, bang, text, target) => {
      if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return full; // scheme: URLs
      if (target.startsWith("#")) return full; // fragment
      const path = target.replace(/^\.\//, "").replace(/^\//, "");
      return `${bang}[${text}](${(bang ? raw : blob) + path})`;
    });
    return out.replace(/\u0000(\d+)\u0000/g, (_, i) => spans[+i]);
  };

  const out = [];
  let inFence = false;
  let fenceChar = "";
  for (const line of md.split("\n")) {
    const open = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (!inFence) {
      if (open) {
        inFence = true;
        fenceChar = open[1][0];
        out.push(line);
      } else {
        out.push(rewriteLine(line));
      }
      continue;
    }
    out.push(line);
    if (new RegExp(`^\\s{0,3}${fenceChar}{3,}\\s*$`).test(line)) inFence = false;
  }
  return out.join("\n");
}

/** The first sentence of the README's intro paragraph (after the H1), as
 *  plain text — the one-liner for the overview page's library index. */
function introSentence(readme) {
  const lines = readme.split("\n");
  let i = lines.findIndex((l) => /^#\s/.test(l)) + 1;
  while (i < lines.length && lines[i].trim() === "") i++;
  const para = [];
  while (i < lines.length && lines[i].trim() !== "") para.push(lines[i++].trim());
  const plain = para
    .join(" ")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  const cut = plain.indexOf(". ");
  const sentence = cut >= 0 ? plain.slice(0, cut + 1) : plain;
  return sentence.length > 180 ? sentence.slice(0, 177).trimEnd() + "…" : sentence;
}

/** The overview page: the content-src template with the generated index table
 *  in place of its marker. Its links stay relative — the site's own cross-link
 *  rewriter resolves them, exactly as for the synced language docs. */
function buildOverviewPage(libs) {
  const template = readFileSync(OVERVIEW_SRC, "utf-8");
  const table = [
    "| Library | What it is |",
    "|---|---|",
    ...libs.map((l) => `| [\`${l.pkg}\`](${l.repo}) | ${introSentence(l.readme)} |`),
  ].join("\n");
  return template.replace(INDEX_MARKER, table);
}

/** The README with the repo/registry note injected after the title H1. */
function buildPage({ repo, pkg, branch, readme }) {
  const md = absolutizeReadmeLinks(readme, repo, branch);
  const note = [
    "> [!NOTE]",
    `> This page mirrors the README of [\`${ORG}/${repo}\`](https://github.com/${ORG}/${repo}).`,
    `> For releases, install info, and the full API reference, see [\`${pkg}\` on the Noeta registry](${REGISTRY}/${pkg}).`,
  ].join("\n");

  const lines = md.split("\n");
  const h1 = lines.findIndex((l) => /^#\s/.test(l));
  if (h1 >= 0) lines.splice(h1 + 1, 0, "", note);
  else lines.unshift(`# ${pkg}`, "", note);
  return lines.join("\n").trimEnd() + "\n";
}

function readLocalLibs() {
  const libs = [];
  for (const name of readdirSync(LOCAL).sort()) {
    if (!/^para-[a-z0-9-]+$/.test(name)) continue;
    const readmePath = join(LOCAL, name, "README.md");
    if (!existsSync(readmePath)) continue;
    const tomlPath = join(LOCAL, name, "noeta.toml");
    const toml = existsSync(tomlPath) ? readFileSync(tomlPath, "utf-8") : null;
    libs.push({
      repo: name,
      pkg: packageName(name, toml),
      branch: "main",
      readme: readFileSync(readmePath, "utf-8"),
    });
  }
  return libs;
}

async function fetchRemoteLibs() {
  const headers = { "User-Agent": "noeta-docs-sync" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const res = await fetch(`https://api.github.com/orgs/${ORG}/repos?per_page=100`, { headers });
  if (!res.ok) throw new Error(`listing ${ORG} repos failed: HTTP ${res.status}`);
  const repos = (await res.json())
    .filter((r) => /^para-/.test(r.name) && !r.archived)
    .sort((a, b) => a.name.localeCompare(b.name));

  const libs = [];
  for (const r of repos) {
    const branch = r.default_branch ?? "main";
    const rawBase = `https://raw.githubusercontent.com/${ORG}/${r.name}/${branch}`;
    const readme = await fetch(`${rawBase}/README.md`, { headers });
    if (!readme.ok) {
      console.warn(`[sync-para] WARNING: no README in ${ORG}/${r.name}@${branch} (HTTP ${readme.status}); skipping`);
      continue;
    }
    const toml = await fetch(`${rawBase}/noeta.toml`, { headers });
    libs.push({
      repo: r.name,
      pkg: packageName(r.name, toml.ok ? await toml.text() : null),
      branch,
      readme: await readme.text(),
    });
  }
  return libs;
}

/** Appends (or replaces, on re-runs against kept content) the marked
 *  "Para libraries" section at the end of the synced _Sidebar.md. */
function appendSidebarSection(libs) {
  const sidebarPath = resolve(docsDir, "_Sidebar.md");
  if (!existsSync(sidebarPath)) return;
  let content = readFileSync(sidebarPath, "utf-8");
  const at = content.indexOf(MARKER);
  if (at >= 0) content = content.slice(0, at);
  const section = [
    MARKER,
    "",
    "**Para libraries**",
    "- [Overview](Para-Libraries)",
    ...libs.map((l) => `- [${l.pkg}](${l.repo})`),
  ].join("\n");
  writeFileSync(sidebarPath, content.trimEnd() + "\n\n" + section + "\n");
}

export async function syncParaLibs() {
  const fromLocal = existsSync(LOCAL);
  const libs = fromLocal ? readLocalLibs() : await fetchRemoteLibs();
  if (libs.length === 0) {
    console.warn(`[sync-para] WARNING: no para libraries found (${fromLocal ? LOCAL : `github.com/${ORG}`})`);
    return;
  }
  libs.sort((a, b) => a.pkg.localeCompare(b.pkg));

  for (const lib of libs) {
    writeFileSync(join(docsDir, `${lib.repo}.md`), buildPage(lib));
  }
  writeFileSync(join(docsDir, "Para-Libraries.md"), buildOverviewPage(libs));
  appendSidebarSection(libs);

  const manifest = libs.map(({ repo, pkg, branch }) => ({ org: ORG, repo, pkg, branch, slug: toDocSlug(repo) }));
  manifest.push({ slug: "para-libraries", edit: OVERVIEW_EDIT_URL });
  writeFileSync(join(docsDir, "_para-libs.json"), JSON.stringify(manifest, null, 2) + "\n");

  console.log(
    `[sync-para] Synced ${libs.length} para libraries from ${fromLocal ? LOCAL : `github.com/${ORG}`}: ` +
      libs.map((l) => l.pkg).join(", "),
  );
}
