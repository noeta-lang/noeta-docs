// Parses the docs' _Sidebar.md into a structured list of items.
// Supports:
//   **Section Header**                           → { kind: 'section', title }
//   [Text](Page-Slug)            (anywhere)      → { kind: 'link', title, slug, depth: 0 }
//   - [Text](Page-Slug)                          → { kind: 'link', title, slug, depth: 0 }
//   - [[Page Name]]                              → { kind: 'link', title, slug, depth: 0 }
//     - [Text](Page-Slug)        (indented)      → { kind: 'link', title, slug, depth: 1 }
//   ---  or empty                                → skipped
// An indented list item is a child of the nearest preceding depth-0 link —
// rendered as a collapsible group (one nesting level; deeper indents clamp).
// Slugs are normalized via toDocSlug so they match the derivation everywhere.

import { toDocSlug } from "./doc-links.mjs";

export function parseSidebar(content) {
  const items = [];
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || /^[-*_]{3,}$/.test(line)) continue;

    // List-item indentation is the nesting signal; anything else is depth 0.
    const indent = rawLine.match(/^(\s+)[-*]\s/)?.[1].length ?? 0;
    const depth = indent >= 2 ? 1 : 0;

    // Strip leading list/heading markers so entries are parsed uniformly
    // (the noeta sidebar uses `### [Home](Home)` for the top link).
    const cleaned = line.replace(/^[-*]\s+/, "").replace(/^#{1,6}\s+/, "");

    const bracket = cleaned.match(/\[\[([^\]]+)\]\]/);
    if (bracket) {
      const name = bracket[1].trim();
      items.push({ kind: "link", title: name, slug: toDocSlug(name), depth });
      continue;
    }

    const md = cleaned.match(/\[([^\]]+)\]\(([^)\s]+)\)/);
    if (md) {
      items.push({ kind: "link", title: md[1].trim(), slug: toDocSlug(md[2].trim()), depth });
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
