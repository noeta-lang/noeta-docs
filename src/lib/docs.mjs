// Docs navigation helpers, shared by the pages and the .md / llms.txt
// endpoints. Slugs, ordering, and titles all come from the same utilities:
//   - scripts/docs-meta.mjs     → listDocs() (slug, title, description, dates,
//                                  cross-link-rewritten markdown), _Sidebar.md order
//   - scripts/parse-sidebar.mjs → parseSidebar() (sections + links)

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { parseSidebar } from "../../scripts/parse-sidebar.mjs";
import { listDocs } from "../../scripts/docs-meta.mjs";
import { pathForSlug } from "../../scripts/doc-links.mjs";

const docsDir = resolve(process.cwd(), "content", "docs");

export { pathForSlug };

// Structured sidebar for rendering: sections + links (with resolved paths), in
// _Sidebar.md order; links pointing at docs that don't exist are dropped.
// Falls back to a flat, title-sorted list when _Sidebar.md is absent.
export function getSidebar() {
  const docs = listDocs();
  const haveSlug = new Set(docs.map((d) => d.slug));
  const sidebarPath = resolve(docsDir, "_Sidebar.md");

  if (existsSync(sidebarPath)) {
    const items = parseSidebar(readFileSync(sidebarPath, "utf-8"));
    const out = [];
    for (const item of items) {
      if (item.kind === "section") {
        out.push({ kind: "section", title: item.title });
      } else if (item.kind === "link" && haveSlug.has(item.slug)) {
        out.push({ kind: "link", title: item.title, slug: item.slug, path: pathForSlug(item.slug) });
      }
    }
    return out;
  }

  return docs.map((d) => ({ kind: "link", title: d.title, slug: d.slug, path: pathForSlug(d.slug) }));
}

// Ordered list of just the sidebar link entries — used for prev/next paging.
export function getSidebarLinks() {
  return getSidebar().filter((e) => e.kind === "link");
}

// The para-library page manifest written by scripts/sync-para.mjs: docs whose
// source is a library repo's README rather than the noeta docs/ dir. Returns
// { org, repo, pkg, branch, slug } for a para page, null for regular docs.
export function getParaLib(slug) {
  const manifestPath = resolve(docsDir, "_para-libs.json");
  if (!existsSync(manifestPath)) return null;
  try {
    return JSON.parse(readFileSync(manifestPath, "utf-8")).find((l) => l.slug === slug) ?? null;
  } catch {
    return null;
  }
}
