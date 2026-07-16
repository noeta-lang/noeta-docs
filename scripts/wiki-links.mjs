// GitHub-Wiki link utilities for the docs synced into content/docs/. Docs live
// at the ROOT of docs.noeta.dev — Home.md is served at /, everything else at
// /<slug> (unlike a /docs-prefixed site).
//
// The rendered HTML goes through src/lib/wiki-links-remark.mjs (mdast-level, so
// code blocks are never touched); rewriteWikiLinks() mirrors it for the raw
// .md endpoints, skipping fenced code blocks and inline code spans.

// Derives a URL slug from a wiki page name or file basename. Strips any
// numeric ordering prefix ("01-", ...) — it controls on-disk ordering only.
export function toDocSlug(source) {
  return source.replace(/^\d+-/, "").toLowerCase().replace(/\s+/g, "-");
}

export function pathForSlug(slug) {
  return slug === "home" ? "/" : `/${slug}`;
}

// [[Page Name]]  →  [Page Name](/page-name)     ([[Home]] → /)
export function convertWikiLinks(src) {
  return src.replace(/\[\[([^\]]+)\]\]/g, (_m, name) => {
    return `[${name}](${pathForSlug(toDocSlug(name))})`;
  });
}

// Rewrites bare wiki-style targets in standard markdown links to root routes.
// GitHub Wiki convention: [Text](Page-Name) where Page-Name is the file
// basename without extension. External URLs, anchors, absolute paths, and
// anything containing a `.` or `/` are left alone.
export function convertWikiPageLinks(src) {
  return src.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (full, text, target) => {
    if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return full; // scheme: URLs
    if (target.startsWith("#")) return full; // fragment
    if (target.startsWith("/")) return full; // absolute
    if (target.includes("/") || target.includes(".")) return full;
    // A wiki target may carry a #fragment after the page name.
    const [page, frag] = target.split("#", 2);
    const href = pathForSlug(toDocSlug(page)) + (frag ? `#${frag}` : "");
    return `[${text}](${href})`;
  });
}

// Apply a wiki-link rewriter to prose only — leaving fenced code blocks
// (``` / ~~~) and inline code spans (`...`) untouched.
function rewriteProse(src, fn) {
  const out = [];
  let inFence = false;
  let fenceChar = "";

  for (const line of src.split("\n")) {
    const open = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (!inFence) {
      if (open) {
        inFence = true;
        fenceChar = open[1][0];
        out.push(line);
        continue;
      }
      out.push(
        line
          .split(/(`+[^`]*`+)/)
          .map((part, i) => (i % 2 === 1 ? part : fn(part)))
          .join(""),
      );
      continue;
    }
    out.push(line);
    if (new RegExp(`^\\s{0,3}${fenceChar}{3,}\\s*$`).test(line)) inFence = false;
  }

  return out.join("\n");
}

export function rewriteWikiLinks(src) {
  return rewriteProse(src, (segment) => convertWikiPageLinks(convertWikiLinks(segment)));
}
