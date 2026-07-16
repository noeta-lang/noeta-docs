/* /<slug>.md — each doc's raw markdown (wiki links rewritten to this site's
 * routes), for agents and curl. Home is at /home.md. */
import type { APIRoute, GetStaticPaths } from "astro";
import { listDocs } from "../../scripts/docs-meta.mjs";

export const getStaticPaths = (() => {
  return listDocs().map((doc) => ({ params: { slug: doc.slug }, props: { doc } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => {
  return new Response(props.doc.markdown, {
    headers: { "content-type": "text/markdown; charset=utf-8" },
  });
};
