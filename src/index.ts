// noeta-docs — a Cloudflare Worker serving docs.noeta.dev.
//
// Placeholder scaffold: returns a single static HTML page. The real content lands next.

const PAGE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Noeta Docs</title>
  </head>
  <body>
    <main>
      <h1>Noeta Docs</h1>
      <p>Guides and reference for the Noeta language and toolchain.</p>
    </main>
  </body>
</html>
`;

export default {
  async fetch(_request: Request): Promise<Response> {
    return new Response(PAGE, {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  },
};
