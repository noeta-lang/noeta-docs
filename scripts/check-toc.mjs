/**
 * Page-contents guard: asserts the "On this page" rail is a working third
 * column at desktop width, folds to a disclosure below --bp-rail, and that its
 * scroll-spy actually tracks the reader.
 *
 * Geometry, not presence — the same lesson as check-chrome.mjs. Every failure
 * this file is written against passes a DOM-level check: a rail that renders
 * behind the article, an article squeezed to a 20rem measure by the third
 * column, an active link marked correctly but scrolled out of the rail's own
 * overflow where nobody can see it, a folded disclosure whose links are in the
 * DOM at 0px. So each of those is measured.
 *
 * The fixture is whichever built page carries the most contents entries, since
 * that is the page where a long list, the rail's internal scrolling and the
 * spy's auto-scroll all actually come into play.
 *
 * Usage:
 *   node scripts/check-toc.mjs [--dist dist]
 *
 * Set CHROME_CHECK_SKIP=1 to skip (environments without Chromium), matching the
 * theme's guards.
 */

import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

if (process.env.CHROME_CHECK_SKIP) {
  console.log("  [toc] CHROME_CHECK_SKIP set — skipping");
  process.exit(0);
}

const args = process.argv.slice(2);
const flagIdx = args.indexOf("--dist");
const dist = resolve(process.cwd(), flagIdx === -1 ? "dist" : args[flagIdx + 1]);

if (!existsSync(dist)) {
  console.error(`  [toc] no build at ${dist} — run the build first`);
  process.exit(2);
}

// --- fixture: the built page with the longest contents list ------------------

let fixture = null;
let mostLinks = 0;
for (const entry of readdirSync(dist)) {
  const index = join(dist, entry, "index.html");
  if (!existsSync(index)) continue;
  const html = readFileSync(index, "utf-8");
  const toc = html.match(/<details class="docs-toc"[\s\S]*?<\/details>/);
  if (!toc) continue;
  const count = [...toc[0].matchAll(/<a /g)].length;
  if (count > mostLinks) {
    mostLinks = count;
    fixture = `/${entry}`;
  }
}

if (!fixture) {
  console.error("  [toc] no page in the build has a contents list — the rail is not rendering at all");
  process.exit(1);
}

// --- static server over dist/ ------------------------------------------------

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".json": "application/json",
  ".ico": "image/x-icon",
};

const server = createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0]);
    let fp = normalize(join(dist, urlPath));
    if (fp !== dist && !fp.startsWith(dist + "/")) {
      res.statusCode = 403;
      return res.end();
    }
    if (existsSync(fp) && statSync(fp).isDirectory()) fp = join(fp, "index.html");
    if (!existsSync(fp)) {
      res.statusCode = 404;
      return res.end();
    }
    res.setHeader("Content-Type", MIME[extname(fp)] ?? "application/octet-stream");
    res.end(await readFile(fp));
  } catch {
    res.statusCode = 500;
    res.end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

const failures = [];
const fail = (msg) => failures.push(msg);

const browser = await chromium.launch();
try {
  // --- desktop: a real third column, and a spy that follows the reader -------
  //
  // 1400x720: past --bp-rail (78rem = 1248px), and short enough that a long
  // contents list has to scroll inside the rail rather than down the page.
  {
    const context = await browser.newContext({ viewport: { width: 1400, height: 720 } });
    const page = await context.newPage();
    await page.goto(`${origin}${fixture}`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);

    const layout = await page.evaluate(() => {
      const toc = document.querySelector("details.docs-toc");
      const article = document.querySelector(".docs-article");
      if (!toc || !article) return null;
      const t = toc.getBoundingClientRect();
      const a = article.getBoundingClientRect();
      return {
        open: toc.open,
        railWidth: t.width,
        railLeft: t.left,
        railBottom: t.bottom,
        articleRight: a.right,
        articleWidth: a.width,
        linkCount: toc.querySelectorAll("a").length,
        renderedLinks: [...toc.querySelectorAll("a")].filter((a2) => a2.offsetHeight > 0).length,
        viewport: window.innerHeight,
        horizontal: document.documentElement.scrollWidth - window.innerWidth,
      };
    });

    if (!layout) {
      fail("no .docs-toc / .docs-article on the fixture page");
    } else {
      if (!layout.open) fail("the contents list is collapsed at 1400px — it should be the open rail");
      if (layout.railWidth <= 0) fail("the contents rail renders at 0px wide at 1400px");
      if (layout.railLeft < layout.articleRight) {
        fail(
          `the rail overlaps the article at 1400px (rail left ${Math.round(layout.railLeft)}px, ` +
            `article right ${Math.round(layout.articleRight)}px)`,
        );
      }
      // The rail is only worth having if the prose survives it.
      if (layout.articleWidth < 520) {
        fail(`the article is ${Math.round(layout.articleWidth)}px wide at 1400px — the third column ate the measure`);
      }
      // A rail taller than the screen is a rail whose tail cannot be reached:
      // it is sticky, so the page scrolling past it does not bring it back.
      if (layout.railBottom > layout.viewport + 1) {
        fail(
          `the rail runs ${Math.round(layout.railBottom - layout.viewport)}px past the bottom of a 720px ` +
            `viewport instead of scrolling inside itself`,
        );
      }
      if (layout.renderedLinks !== layout.linkCount) {
        fail(`${layout.linkCount - layout.renderedLinks} of ${layout.linkCount} rail links render at 0px`);
      }
      if (layout.horizontal > 0) fail(`the page scrolls horizontally by ${layout.horizontal}px at 1400px`);
    }

    // The spy: scroll to a heading deep in the page and demand that its own row
    // is the marked one — and that the row is visible inside the rail's scroller.
    const spy = await page.evaluate(async () => {
      const toc = document.querySelector("details.docs-toc");
      const links = [...toc.querySelectorAll("a")];
      // The site scrolls smoothly; this is testing where the spy lands, not how
      // long the animation takes, so jump instead and wait for the page to
      // settle. (Without this the assertions race the animation and report the
      // section the scroll was still passing through.)
      document.documentElement.style.scrollBehavior = "auto";
      const settle = async () => {
        let last = -1;
        for (let i = 0; i < 40 && last !== window.scrollY; i++) {
          last = window.scrollY;
          await new Promise((r) => setTimeout(r, 50));
        }
      };
      const probe = links[Math.min(links.length - 1, Math.floor(links.length * 0.6))];
      const target = document.getElementById(decodeURIComponent(probe.hash.slice(1)));
      target.scrollIntoView();
      await settle();
      const active = toc.querySelector("a.active");
      const rowVisible = (() => {
        if (!active) return false;
        const row = active.getBoundingClientRect();
        const rail = toc.getBoundingClientRect();
        return row.top >= rail.top - 1 && row.bottom <= rail.bottom + 1;
      })();
      const wanted = probe.getAttribute("href");
      // …and at the very bottom of the page, the last section is the live one.
      window.scrollTo(0, document.documentElement.scrollHeight);
      await settle();
      const atEnd = toc.querySelector("a.active");
      return {
        wanted,
        got: active ? active.getAttribute("href") : null,
        rowVisible,
        lastWanted: links[links.length - 1].getAttribute("href"),
        lastGot: atEnd ? atEnd.getAttribute("href") : null,
      };
    });

    if (spy.got !== spy.wanted) {
      fail(`scrolled to ${spy.wanted}, but the rail marks ${spy.got ?? "nothing"} as active`);
    } else if (!spy.rowVisible) {
      fail(`the active row ${spy.wanted} is marked but scrolled out of the rail's own overflow`);
    }
    if (spy.lastGot !== spy.lastWanted) {
      fail(`at the bottom of the page the rail marks ${spy.lastGot ?? "nothing"}, not ${spy.lastWanted}`);
    }

    if (!failures.length) {
      console.log(
        `  [toc] 1400px: ${mostLinks}-entry rail beside a ${Math.round(layout.articleWidth)}px article, ` +
          `spy tracks the reader`,
      );
    }
    await context.close();
  }

  // --- folded: a closed disclosure above the article, and it opens -----------
  {
    const context = await browser.newContext({ viewport: { width: 1100, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${origin}${fixture}`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);

    const folded = await page.evaluate(() => {
      const toc = document.querySelector("details.docs-toc");
      const article = document.querySelector(".docs-article");
      const t = toc.getBoundingClientRect();
      const a = article.getBoundingClientRect();
      return { open: toc.open, tocBottom: t.bottom, articleTop: a.top, tocLeft: t.left, articleLeft: a.left };
    });

    if (folded.open) fail("the contents list is still open at 1100px — it should fold to a disclosure");
    if (folded.tocBottom > folded.articleTop + 1) {
      fail("the folded contents do not sit above the article at 1100px");
    }
    if (Math.abs(folded.tocLeft - folded.articleLeft) > 1) {
      fail("the folded contents are not aligned with the article column at 1100px");
    }

    const opened = await page.evaluate(async () => {
      const toc = document.querySelector("details.docs-toc");
      toc.querySelector("summary").click();
      await new Promise((r) => setTimeout(r, 200));
      const links = [...toc.querySelectorAll("a")];
      return {
        open: toc.open,
        links: links.length,
        rendered: links.filter((a) => a.offsetHeight > 0).length,
      };
    });

    if (!opened.open) fail("clicking the folded contents summary did not open it at 1100px");
    if (opened.rendered !== opened.links) {
      fail(`${opened.links - opened.rendered} of ${opened.links} contents links render at 0px once opened`);
    }
    if (!failures.length) console.log(`  [toc] 1100px: folds to a disclosure above the article, opens to ${opened.links} links`);
    await context.close();
  }
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}

if (!failures.length) {
  console.log(`  [toc] page contents behave, on ${fixture}`);
  process.exit(0);
}
console.error(`\n  [toc] ${failures.length} problem(s) on ${fixture}:`);
for (const f of failures) console.error(`      ${f}`);
process.exit(1);
