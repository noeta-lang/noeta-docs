# noeta-docs

The [Noeta](https://noeta.dev) project & language documentation site — docs.noeta.dev.

An [Astro](https://astro.build) static site on the shared [@noeta/theme](../noeta-theme)
design system ("Ink & Signal"), deployed as a Cloudflare Worker with static assets. The
content is the noeta repo's `docs/` directory — versioned together with the code — as flat
pages (`Home.md`, `_Sidebar.md` for navigation, `[[Page Name]]` cross-links), compiled to
pages at the site root and searchable via [Pagefind](https://pagefind.app).

## How content flows

- `scripts/sync-docs.mjs` (predev/prebuild) populates `content/docs/` — from the local
  `../lang/docs` checkout when present, else a blobless sparse clone of the hosted repo
  (`NOETA_DOCS_REPO`/`NOETA_DOCS_REF`; `NOETA_SKIP_SYNC=1` to use what's there).
- `Home.md` is served at `/`; every other page at `/<slug>` (`_Sidebar.md` drives nav order
  and prev/next paging). Cross-links are rewritten at the mdast level so code blocks are
  never touched.
- ```` ```noeta ```` fences are highlighted with the language repo's canonical TextMate
  grammar: `scripts/sync-grammars.mjs` (predev/prebuild, same local-checkout/sparse-clone
  sources as sync-docs) copies `noeta.tmLanguage.json` plus the tier-languages injection
  grammar into the gitignored `syntaxes/`, and `remark-noeta-code.mjs` runs them through
  shiki with a theme mapped onto the Ink & Signal `--syn-*` variables (so light/dark just
  follow the site palette). The injection grammar colors embedded tier bodies —
  `@sql { … }` as SQL, etc., with `${…}` holes back to Noeta. Other languages go through
  Astro's built-in shiki (dual GitHub themes).
- Search: `astro-pagefind` indexes the article bodies (`data-pagefind-body`) at build time;
  the searchbox is themed via `--pf-*` variables.
- Agent-friendly mirrors: `/llms.txt` indexes the docs, and each page is served raw at
  `/<slug>.md`.
- SEO: canonical + OG/Twitter meta, TechArticle JSON-LD per doc, sitemap, robots.txt, and a
  Playwright-rendered OG card (`/og` → `dist/images/og-image.png`, then deleted).

## Layout

Three columns: the `_Sidebar.md` nav, the article, and an "On this page" rail built from the
page's own h2/h3 headings with a scroll-spy marking the section being read. The h3s are grouped
under their h2 and only the section being read expands, so a reference page with 86 headings
reads as a map rather than a wall; the grouping is applied from script, so with no JS the full
list stands. The rail needs
room, so this site (alone among the four) opts into the theme's wide page width —
`data-layout="wide"` on `<html>`, which takes `--max` from 72rem to 84rem and widens the
shared header and footer with it. Below the theme's `--bp-rail` (78rem) the rail folds into a
collapsed disclosure above the article, styled to match the sidebar's own "Contents" toggle;
below 56rem everything stacks; below 38rem the nav tree moves into the shared chrome drawer.

## Gates

```sh
pnpm run typecheck       # astro check over the pages, components and lib/
pnpm run check:links     # dead internal links + #anchors (also same-page) over dist/
pnpm run check:toc       # the page-contents rail: placement, fold, scroll-spy
pnpm run check:overflow  # no horizontal scroll at 320/360/390/414px  (@noeta/theme)
pnpm run check:chrome    # header folds into a working drawer         (@noeta/theme)
```

All of them run against a build (`pnpm run build` first — `astro check` needs the synced
content collection too). `check:toc` and the two theme guards drive Chromium through
`playwright-core`; set `CHROME_CHECK_SKIP=1` where there is none. The deploy workflow runs
`typecheck`, `check:links` and `check:toc`.

## Local development

```sh
pnpm install
pnpm run dev        # syncs docs, then astro dev — http://localhost:4321
pnpm run build      # dist/ + pagefind index + OG image (needs a Playwright chromium)
pnpm run preview    # build, then serve dist/ through wrangler
```

## Deploy (your Cloudflare account)

```sh
pnpm run deploy
```

Then bind the custom domain docs.noeta.dev via the `routes` entry in `wrangler.jsonc`. The
GitHub workflow needs `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` secrets and clones
the theme repo next to the site checkout.

Generated with assistance from Claude Code; not yet deployed.
