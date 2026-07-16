// Parses the GitHub-Wiki-style _Sidebar.md into a structured list of items.
// Supports:
//   **Section Header**                           → { kind: 'section', title }
//   [Text](Page-Slug)            (anywhere)      → { kind: 'link', title, slug }
//   - [Text](Page-Slug)                          → { kind: 'link', title, slug }
//   - [[Wiki Link]]                              → { kind: 'link', title, slug }
//   ---  or empty                                → skipped
// Slugs are normalized via toDocSlug so they match the derivation everywhere.

import { toDocSlug } from "./wiki-links.mjs";

export function parseSidebar(content) {
  const items = [];
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || /^[-*_]{3,}$/.test(line)) continue;

    // Strip leading list/heading markers so entries are parsed uniformly
    // (the noeta sidebar uses `### [Home](Home)` for the top link).
    const cleaned = line.replace(/^[-*]\s+/, "").replace(/^#{1,6}\s+/, "");

    const wiki = cleaned.match(/\[\[([^\]]+)\]\]/);
    if (wiki) {
      const name = wiki[1].trim();
      items.push({ kind: "link", title: name, slug: toDocSlug(name) });
      continue;
    }

    const md = cleaned.match(/\[([^\]]+)\]\(([^)\s]+)\)/);
    if (md) {
      items.push({ kind: "link", title: md[1].trim(), slug: toDocSlug(md[2].trim()) });
      continue;
    }

    const section = cleaned.match(/^\*\*(.+?)\*\*$/);
    if (section) {
      items.push({ kind: "section", title: section[1].trim() });
      continue;
    }
  }
  return items;
}

// Returns just the link slugs in order (used for sorting and pager nav).
export function sidebarLinkSlugs(items) {
  return items.filter((i) => i.kind === "link").map((i) => i.slug);
}
