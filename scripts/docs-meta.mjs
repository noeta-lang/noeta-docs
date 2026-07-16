import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { resolve, basename } from "node:path";
import { parseSidebar, sidebarLinkSlugs } from "./parse-sidebar.mjs";
import { rewriteDocLinks, toDocSlug } from "./doc-links.mjs";

// Resolve from the project root (process.cwd()) so this keeps working when
// Astro bundles it into dist/.prerender/.
const docsDir = resolve(process.cwd(), "content", "docs");

// First non-heading paragraph, plain text, max ~160 chars — feeds the meta
// description, OG/Twitter, llms.txt, and TechArticle JSON-LD.
function extractDescription(raw) {
  const lines = raw.split(/\r?\n/);
  let buf = "";
  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      if (buf) break;
      continue;
    }
    if (/^#+\s/.test(t)) continue;
    if (/^(?:[-_*]\s*){3,}$/.test(t)) continue;
    if (/^[-*]\s|^\d+\.\s|^>|^```/.test(t)) {
      if (buf) break;
      continue;
    }
    buf += (buf ? " " : "") + t;
    if (buf.length >= 200) break;
  }
  if (!buf) return "";
  let plain = buf
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  if (plain.length > 160) plain = plain.slice(0, 157).trimEnd() + "…";
  return plain;
}

// datePublished / dateModified for a doc file. docs/ is synced (copied or
// shallow-cloned), so per-file git history isn't available — fall back to the
// file mtime for both.
function fileDates(filePath) {
  const iso = statSync(filePath).mtime.toISOString();
  return { datePublished: iso, dateModified: iso };
}

function readSidebarOrder() {
  const sidebarPath = resolve(docsDir, "_Sidebar.md");
  if (!existsSync(sidebarPath)) return null;
  const items = parseSidebar(readFileSync(sidebarPath, "utf-8"));
  const slugs = sidebarLinkSlugs(items);
  return slugs.length > 0 ? slugs : null;
}

// Returns [{ slug, title, sourcePath, description, datePublished, dateModified,
// markdown }] ordered by _Sidebar.md (when present) then alphabetically.
export function listDocs() {
  if (!existsSync(docsDir)) return [];

  const files = readdirSync(docsDir).filter((f) => f.endsWith(".md") && !f.startsWith("_"));

  const docs = files.map((file) => {
    const filePath = resolve(docsDir, file);
    const raw = readFileSync(filePath, "utf-8");
    const sourcePath = basename(file, ".md");
    const slug = toDocSlug(sourcePath);
    const titleMatch = raw.match(/^#\s+(.+)\s*$/m);
    const title = titleMatch ? titleMatch[1].trim() : sourcePath.replace(/-/g, " ");
    const description = extractDescription(raw);
    const markdown = rewriteDocLinks(raw);
    const { datePublished, dateModified } = fileDates(filePath);
    return { slug, title, sourcePath, description, datePublished, dateModified, markdown };
  });

  const order = readSidebarOrder();
  if (order) {
    const orderMap = new Map(order.map((slug, i) => [slug, i]));
    docs.sort((a, b) => {
      const ai = orderMap.has(a.slug) ? orderMap.get(a.slug) : 999;
      const bi = orderMap.has(b.slug) ? orderMap.get(b.slug) : 999;
      return ai - bi;
    });
  } else {
    docs.sort((a, b) => a.title.localeCompare(b.title));
  }

  return docs;
}
