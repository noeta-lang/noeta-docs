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
  themeColor: "#0b0d10",
  themeColorLight: "#f6f8fb",
  /** The Noeta release these docs document, baked in at build from NOETA_VERSION (the deploy
   *  workflow sets it to the latest release tag). null on an unreleased checkout — local dev, or
   *  before the first release — so the UI simply omits the version. */
  version: process.env.NOETA_VERSION ?? null,
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
