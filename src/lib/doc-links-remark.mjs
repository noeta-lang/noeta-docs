// Remark plugin: rewrites the docs' cross-link shorthand to this site's root
// routes.
// Operating on the mdast means fenced code blocks are skipped automatically —
// a literal `[[rules]]` inside a code block is left intact.
//
// Two cases (mirroring scripts/doc-links.mjs, which handles the raw .md
// endpoints):
//   [[Page Name]]            (in text)  → link to /page-name  ([[Home]] → /)
//   [Text](Bare-Page-Slug)   (a link)   → /<slug>
// External URLs, anchors, absolute paths, and targets containing `/` or `.`
// are left untouched.

import { pathForSlug, toDocSlug } from "../../scripts/doc-links.mjs";

function isBarePageTarget(target) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return false; // scheme: URLs
  if (target.startsWith("#")) return false; // fragment
  if (target.startsWith("/")) return false; // absolute
  const page = target.split("#", 2)[0];
  if (page.includes("/") || page.includes(".")) return false;
  return true;
}

function rewriteTarget(target) {
  const [page, frag] = target.split("#", 2);
  return pathForSlug(toDocSlug(page)) + (frag ? `#${frag}` : "");
}

// Split a text value containing [[Page Name]] bracket links into a mix of text
// and link mdast nodes.
function expandBracketLinks(value) {
  const out = [];
  const re = /\[\[([^\]]+)\]\]/g;
  let last = 0;
  let m;
  while ((m = re.exec(value)) !== null) {
    if (m.index > last) out.push({ type: "text", value: value.slice(last, m.index) });
    const name = m[1].trim();
    out.push({
      type: "link",
      url: pathForSlug(toDocSlug(name)),
      children: [{ type: "text", value: name }],
    });
    last = m.index + m[0].length;
  }
  if (last < value.length) out.push({ type: "text", value: value.slice(last) });
  return out;
}

function walk(node) {
  if (!node || !Array.isArray(node.children)) return;

  const next = [];
  for (const child of node.children) {
    if (child.type === "link" && typeof child.url === "string" && isBarePageTarget(child.url)) {
      child.url = rewriteTarget(child.url);
    }

    // `code` / `inlineCode` nodes carry their content on `.value` with no
    // children, so walk() returns early for them — never rewritten.
    if (child.type === "text" && child.value.includes("[[")) {
      next.push(...expandBracketLinks(child.value));
      continue;
    }

    walk(child);
    next.push(child);
  }
  node.children = next;
}

export default function remarkDocLinks() {
  return (tree) => walk(tree);
}
