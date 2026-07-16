# noeta-docs

The [Noeta](https://noeta.dev) project & language documentation site — docs.noeta.dev.

An [Astro](https://astro.build) static site on the shared [@noeta/theme](../noeta-theme)
design system ("Ink & Signal"), deployed as a Cloudflare Worker with static assets. The
content is the noeta repo's `docs/` (GitHub-wiki conventions: `Home.md`, `_Sidebar.md`,
`[[wiki links]]`), compiled to pages at the site root and searchable via
[Pagefind](https://pagefind.app).

## How content flows

- `scripts/sync-docs.mjs` (predev/prebuild) populates `content/docs/` — from the local
  `../lang/docs` checkout when present, else a blobless sparse clone of the hosted repo
  (`NOETA_DOCS_REPO`/`NOETA_DOCS_REF`; `NOETA_SKIP_SYNC=1` to use what's there).
- `Home.md` is served at `/`; every other page at `/<slug>` (`_Sidebar.md` drives nav order
  and prev/next paging). Wiki links are rewritten at the mdast level so code blocks are
  never touched.
- ```` ```noeta ```` fences are highlighted by the shared `@noeta/theme/highlight`
  tokenizer; other languages go through shiki (vesper theme).
- Search: `astro-pagefind` indexes the article bodies (`data-pagefind-body`) at build time;
  the searchbox is themed via `--pf-*` variables.
- Agent-friendly mirrors: `/llms.txt` indexes the docs, and each page is served raw at
  `/<slug>.md`.
- SEO: canonical + OG/Twitter meta, TechArticle JSON-LD per doc, sitemap, robots.txt, and a
  Playwright-rendered OG card (`/og` → `dist/images/og-image.png`, then deleted).

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
