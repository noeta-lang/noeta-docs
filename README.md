# noeta-docs

The Noeta project & language documentation site.

Served at **docs.noeta.dev**. A dependency-free Cloudflare Worker (no runtime npm deps).

## Local development

```sh
pnpm install
pnpm run dev        # wrangler dev — http://localhost:8787
```

## Deploy (your Cloudflare account)

```sh
pnpm run deploy
```

Then bind the custom domain docs.noeta.dev via the `routes` entry in `wrangler.jsonc`.

Generated with assistance from Claude Code; not yet deployed.
