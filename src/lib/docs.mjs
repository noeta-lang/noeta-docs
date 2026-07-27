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
// _Sidebar.md order; links pointing at docs that don't exist are dropped. An
// indented sidebar item (depth 1) becomes a child of the nearest preceding
// top-level link — its collapsible group. Every link entry carries `children`
// (usually empty). Falls back to a flat, title-sorted list when _Sidebar.md is
// absent.
/**
 * `kind` discriminates the two entry shapes, so it has to carry a literal type:
 * left to inference these object literals widen to `{ kind: string, … }`,
 * `entry.kind === "link"` then narrows nothing, and every consumer's
 * `entry.path` / `entry.children` is a type error. Hence the annotations.
 *
 * @typedef {{ kind: "section", title: string }} SidebarSection
 * @typedef {{ kind: "link", title: string, slug: string, path: string, children: SidebarLink[] }} SidebarLink
 * @typedef {SidebarSection | SidebarLink} SidebarEntry
 *
 * @returns {SidebarEntry[]}
 */
export function getSidebar() {
  const docs = listDocs();
  const haveSlug = new Set(docs.map((d) => d.slug));
  const sidebarPath = resolve(docsDir, "_Sidebar.md");

  if (existsSync(sidebarPath)) {
    const items = parseSidebar(readFileSync(sidebarPath, "utf-8"));
    /** @type {SidebarEntry[]} */
    const out = [];
    /** @type {SidebarLink | null} */
    let lastLink = null;
    for (const item of items) {
      if (item.kind === "section") {
        out.push({ kind: "section", title: item.title });
        lastLink = null;
      } else if (item.kind === "link" && haveSlug.has(item.slug)) {
        /** @type {SidebarLink} */
        const entry = {
          kind: "link",
          title: item.title,
          slug: item.slug,
          path: pathForSlug(item.slug),
          children: [],
        };
        if (item.depth > 0 && lastLink) {
          lastLink.children.push(entry);
        } else {
          out.push(entry);
          lastLink = entry;
        }
      }
    }
    return out;
  }

  return docs.map((d) => ({ kind: "link", title: d.title, slug: d.slug, path: pathForSlug(d.slug), children: [] }));
}

// Ordered list of just the sidebar link entries, groups flattened in reading
// order (parent, then its children) — used for prev/next paging.
/** @returns {SidebarLink[]} */
export function getSidebarLinks() {
  // One flatMap rather than filter-then-flatMap: a filter does not narrow the
  // union, so the `.children` in the second step would be reading a property
  // the section shape does not have.
  return getSidebar().flatMap((e) => (e.kind === "link" ? [e, ...e.children] : []));
}

// The para-library page manifest written by scripts/sync-para.mjs: docs whose
// source is a library repo's README rather than the noeta docs/ dir. Returns
// { org, repo, pkg, branch, slug } for a para page, null for regular docs.
export function getParaLib(slug) {
  return findInManifest("_para-libs.json", slug);
}

// The std-reference manifest written by scripts/sync-std.mjs: generated pages
// whose "edit" target is the intrinsic registry source (or, for the overview,
// the template in this repo). Returns { slug, edit } or null.
export function getStdModule(slug) {
  return findInManifest("_std-modules.json", slug);
}

function findInManifest(name, slug) {
  const manifestPath = resolve(docsDir, name);
  if (!existsSync(manifestPath)) return null;
  try {
    return JSON.parse(readFileSync(manifestPath, "utf-8")).find((l) => l.slug === slug) ?? null;
  } catch {
    return null;
  }
}
