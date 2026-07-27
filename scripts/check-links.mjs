/**
 * Dead-link gate over the built site (dist/): every internal href must resolve
 * to a built page or asset, and every #fragment — on another page or on this
 * one — must match an id in the page it points at. Run after `astro build` —
 * `pnpm run check:links`; the deploy workflow fails on a broken link.
 *
 * Generated-section tolerance: the std reference and para pages are generated
 * at build time and can be legitimately absent (no released binary asset, para
 * repos unreachable) — sync-std/sync-para skip them gracefully rather than
 * failing the build. Links pointing into an ABSENT generated section demote to
 * warnings, keyed off the section manifests the syncs write; when the section
 * was generated, its links are checked as strictly as any other.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const DIST = resolve(process.cwd(), "dist");
const docsDir = resolve(process.cwd(), "content", "docs");

const paraPresent = existsSync(join(docsDir, "_para-libs.json"));
const stdPresent = existsSync(join(docsDir, "_std-modules.json"));
const inAbsentSection = (slug) =>
  (!paraPresent && (slug.startsWith("para-") || slug === "para-libraries")) ||
  (!stdPresent && (slug === "std" || slug.startsWith("std-")));

const pages = new Map(); // "/slug" (or "/") -> html
for (const entry of readdirSync(DIST)) {
  const idx = join(DIST, entry, "index.html");
  if (existsSync(idx)) pages.set(`/${entry}`, readFileSync(idx, "utf-8"));
}
pages.set("/", readFileSync(join(DIST, "index.html"), "utf-8"));

const idsOf = (html) => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
const idCache = new Map();
// Ids are written raw in the HTML but a fragment may be percent-encoded; compare
// both spellings rather than reporting an encoding difference as a dead anchor.
const safeDecode = (s) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

let broken = 0;
let warned = 0;
for (const [page, html] of pages) {
  for (const m of html.matchAll(/href="(\/[^"#]*)(#[^"]*)?"/g)) {
    const [, path, frag] = m;
    if (/\.[a-z0-9]+$/i.test(path)) {
      if (!existsSync(join(DIST, path))) {
        console.error(`${page}: missing asset ${path}`);
        broken++;
      }
      continue;
    }
    const target = path.replace(/\/$/, "") || "/";
    if (!pages.has(target)) {
      if (inAbsentSection(target.slice(1))) {
        console.warn(`${page}: link into absent generated section ${path} (tolerated)`);
        warned++;
      } else {
        console.error(`${page}: dead link ${path}`);
        broken++;
      }
      continue;
    }
    if (frag && frag.length > 1) {
      if (!idCache.has(target)) idCache.set(target, idsOf(pages.get(target)));
      if (!idCache.get(target).has(frag.slice(1))) {
        console.error(`${page}: missing anchor ${target}${frag}`);
        broken++;
      }
    }
  }

  // Same-page fragments (`href="#..."`) — the page-contents rail and any
  // in-page prose link. Worth checking separately because the rail's hrefs come
  // from Astro's own headings array while the ids come from rehype-slug: two
  // slug implementations that agree, and this is what proves they still do.
  if (!idCache.has(page)) idCache.set(page, idsOf(html));
  for (const m of html.matchAll(/href="#([^"]+)"/g)) {
    const frag = m[1];
    const ids = idCache.get(page);
    if (!ids.has(frag) && !ids.has(safeDecode(frag))) {
      console.error(`${page}: missing anchor #${frag} on its own page`);
      broken++;
    }
  }
}

if (broken > 0) {
  console.error(`check-links: ${broken} broken link(s)/anchor(s) across ${pages.size} pages`);
  process.exit(1);
}
console.log(
  `check-links: OK — ${pages.size} pages, all internal links + anchors resolve` +
    (warned ? ` (${warned} tolerated into absent generated sections)` : ""),
);
