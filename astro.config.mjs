// noeta-docs — the docs.noeta.dev documentation site. Static Astro build served
// as a Cloudflare Worker with static assets (see wrangler.jsonc). Content is
// synced from the noeta repo's docs/ by scripts/sync-docs.mjs (predev/prebuild).
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import pagefind from "astro-pagefind";
import rehypeSlug from "rehype-slug";
import remarkDocLinks from "./src/lib/doc-links-remark.mjs";
import remarkNoetaCode from "./src/lib/remark-noeta-code.mjs";

export default defineConfig({
  site: "https://docs.noeta.dev",
  output: "static",
  build: { format: "directory" },
  integrations: [
    sitemap({
      // /og is the OG-image screenshot target (deleted post-build); never index it.
      filter: (page) => !/\/og\/?$/.test(page),
      serialize(item) {
        // Match the no-trailing-slash canonical URLs BaseHead emits.
        item.url = item.url.replace(/\/$/, "");
        return item;
      },
    }),
    // Indexes the built HTML (data-pagefind-body) on build and serves
    // /pagefind/* in dev.
    pagefind(),
  ],
  markdown: {
    // ```noeta fences are handled by remarkNoetaCode (the shared @noeta/theme
    // highlighter); shiki takes the other languages. Dual themes with
    // defaultColor:false emit --shiki-light/--shiki-dark custom properties per
    // token, so code blocks follow the site's light/dark mode (wired up in
    // docs.css). Cool, neutral GitHub themes to match "Signal".
    shikiConfig: {
      themes: { light: "github-light-default", dark: "github-dark-default" },
      defaultColor: false,
    },
    smartypants: false,
    remarkPlugins: [remarkDocLinks, remarkNoetaCode],
    rehypePlugins: [rehypeSlug],
  },
});
