import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";

// Documentation synced from the noeta repo's docs/ into content/docs/. Plain
// Markdown with no frontmatter — the title is the leading H1, derived at the
// page layer. The `[^_]*.md` pattern excludes underscore-prefixed files
// (_Sidebar.md, _Footer.md); the sidebar is parsed separately.
const docs = defineCollection({
  loader: glob({ pattern: "[^_]*.md", base: "./content/docs" }),
});

export const collections = { docs };
