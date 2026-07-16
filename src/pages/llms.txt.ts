/* /llms.txt — an index of the documentation for language models, per the
 * llms.txt convention. Each doc is also served raw at /<slug>.md. Fitting for
 * a language that calls itself AI-native. */
import type { APIRoute } from "astro";
import { listDocs } from "../../scripts/docs-meta.mjs";
import { SITE } from "../lib/site";

export const GET: APIRoute = () => {
  const docs = listDocs();
  const lines = [
    "# Noeta Docs",
    "",
    "> " + SITE.description,
    "",
    "## Docs",
    "",
    ...docs.map((d) => {
      const url = d.slug === "home" ? `${SITE.url}/home.md` : `${SITE.url}/${d.slug}.md`;
      return `- [${d.title}](${url})${d.description ? `: ${d.description}` : ""}`;
    }),
  ];
  return new Response(lines.join("\n") + "\n", {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
};
