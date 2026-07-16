/* Site-wide constants: one place for the copy that must stay consistent across
 * pages, <head> metadata, JSON-LD, and the OG image. */

export const SITE = {
  name: "Noeta Docs",
  url: "https://docs.noeta.dev",
  title: "Noeta Docs — guides and reference for the Noeta language",
  description:
    "Documentation for Noeta, the AI-native, human-first programming language: getting started, " +
    "the language tour, tooling (LSP, DAP, MCP, formatter), the type system, reactivity, and more.",
  ogImage: "https://docs.noeta.dev/images/og-image.png",
  themeColor: "#131110",
  /** GitHub repo + branch the docs are synced from — drives "Edit on GitHub". */
  docsRepo: "noeta-lang/noeta",
  docsBranch: "main",
  links: {
    home: "https://noeta.dev",
    registry: "https://registry.noeta.dev",
    playground: "https://play.noeta.dev",
    github: "https://github.com/noeta-lang/noeta",
  },
} as const;
