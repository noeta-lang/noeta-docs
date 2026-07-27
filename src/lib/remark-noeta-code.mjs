// Remark plugin: renders ```noeta / ```noe fences with the CANONICAL Noeta
// TextMate grammar (synced into syntaxes/ by scripts/sync-grammars.mjs) through
// shiki, instead of Astro's built-in shiki pass (which has no Noeta grammar and
// would fall back to unstyled plaintext with a build warning). Emitting a raw
// html node here means Astro's shiki never sees these blocks; every other
// language stays on the built-in pass (github dual themes).
//
// Two grammars are registered:
//   - noeta.tmLanguage.json          — the core grammar (source.noeta)
//   - tier-languages.tmLanguage.json — the injection grammar (injectTo
//     source.noeta) that colors embedded-language tier bodies: @sql{…} as SQL,
//     @html{…} as HTML, …, with ${…} holes scoped back to source.noeta. The
//     languages it injects are preloaded below so the includes resolve.
//
// Instead of a pre-baked color theme, the shiki theme maps TextMate scopes to
// the Ink & Signal syntax variables (--syn-* from @noeta/theme), i.e. the same
// palette the old tok-* highlighter used. Shiki passes `var(…)` foregrounds
// straight through to inline styles, and the variables flip with
// prefers-color-scheme, so light/dark keeps working with a single theme.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHighlighter } from "shiki";
import { splitSample } from "./noeta-sample.mjs";

// Resolved from the project root, not import.meta.url: og.astro imports this
// module too, and prerendered pages are bundled into dist/.prerender/chunks/,
// where a module-relative path would point at dist/syntaxes/. Astro always
// runs with cwd = project root (both for the config's remark pass and the
// prerender), so a cwd-based path works in every context.
const grammar = (file) =>
  JSON.parse(readFileSync(resolve(process.cwd(), "syntaxes", file), "utf8"));

/** Languages the tier-languages injection grammar embeds (by scope name). */
const TIER_LANGS = [
  "sql",
  "html",
  "css",
  "json",
  "yaml",
  "xml",
  "graphql",
  "markdown",
  "javascript",
  "python",
  "shellscript",
  "toml",
  "sparql",
];

/** Ink & Signal as a shiki theme: scope → the site's --syn-* CSS variables. */
const inkSignal = {
  name: "noeta-ink-signal",
  type: "dark",
  colors: {
    "editor.foreground": "var(--text-0)",
    "editor.background": "transparent",
  },
  settings: [
    { settings: { foreground: "var(--text-0)", background: "transparent" } },
    { scope: "comment", settings: { foreground: "var(--syn-comment)", fontStyle: "italic" } },
    { scope: ["string", "punctuation.definition.string", "constant.character.escape"], settings: { foreground: "var(--syn-string)" } },
    { scope: "constant.numeric", settings: { foreground: "var(--syn-number)" } },
    { scope: ["keyword", "storage", "constant.language", "variable.language"], settings: { foreground: "var(--syn-keyword)" } },
    // Symbolic operators stay plain (as the site always rendered them);
    // word operators (`is`, `and`, …) read as keywords.
    { scope: "keyword.operator", settings: { foreground: "var(--text-0)" } },
    { scope: "keyword.operator.word", settings: { foreground: "var(--syn-keyword)" } },
    { scope: ["entity.name.type", "support.type", "support.class"], settings: { foreground: "var(--syn-type)" } },
    { scope: ["entity.name.function", "support.function"], settings: { foreground: "var(--syn-fn)" } },
    // @directives and @tier{…} openers — the tok-tier accent.
    { scope: "entity.name.function.decorator", settings: { foreground: "var(--accent-2-bright)" } },
    { scope: "entity.name.tag", settings: { foreground: "var(--syn-tag)" } },
    { scope: "entity.other.attribute-name", settings: { foreground: "var(--syn-string)" } },
    // ${…} interpolation/hole delimiters — the tok-hole accent.
    { scope: ["punctuation.definition.template-expression", "punctuation.section.embedded"], settings: { foreground: "var(--syn-hole)" } },
    // Markdown bodies inside @doc/text tiers.
    { scope: "markup.heading", settings: { foreground: "var(--syn-keyword)", fontStyle: "bold" } },
    { scope: "markup.bold", settings: { fontStyle: "bold" } },
    { scope: "markup.italic", settings: { fontStyle: "italic" } },
    { scope: "markup.inline.raw", settings: { foreground: "var(--syn-string)" } },
  ],
};

let highlighterPromise;
function getHighlighter() {
  highlighterPromise ??= createHighlighter({
    themes: [inkSignal],
    langs: [
      ...TIER_LANGS,
      { ...grammar("noeta.tmLanguage.json"), name: "noeta" },
      {
        ...grammar("tier-languages.tmLanguage.json"),
        name: "noeta-tier-languages",
        injectTo: ["source.noeta"],
      },
    ],
    langAlias: { noe: "noeta" },
  });
  return highlighterPromise;
}

/**
 * Highlight Noeta source into inner HTML (token spans with inline
 * `var(--syn-*)` colors, one `span.line` per source line) for embedding in a
 * caller-owned `<pre><code>` — used by og.astro, whose card brings its own
 * code-window chrome.
 * @param {string} code
 * @returns {Promise<string>} HTML
 */
export async function highlightNoetaInline(code) {
  const highlighter = await getHighlighter();
  const html = highlighter.codeToHtml(code, { lang: "noeta", theme: "noeta-ink-signal" });
  const match = /^<pre[^>]*><code[^>]*>([\s\S]*)<\/code><\/pre>\s*$/.exec(html);
  if (!match) throw new Error("unexpected shiki output shape");
  return match[1];
}

function collect(node, found) {
  if (!node || !Array.isArray(node.children)) return;
  node.children.forEach((child, index) => {
    if (child.type === "code" && (child.lang === "noeta" || child.lang === "noe")) {
      found.push({ parent: node, index });
    } else {
      collect(child, found);
    }
  });
}

/** Highlight one block into a `<pre class="noeta-code">…</pre>`. */
function render(highlighter, code) {
  return highlighter.codeToHtml(code, {
    lang: "noeta",
    theme: "noeta-ink-signal",
    transformers: [
      {
        pre(node) {
          this.addClassToHast(node, "noeta-code");
        },
      },
    ],
  });
}

export default function remarkNoetaCode() {
  return async (tree) => {
    const found = [];
    collect(tree, found);
    if (found.length === 0) return;
    const highlighter = await getHighlighter();
    for (const { parent, index } of found) {
      // A block may mark the region worth reading with `// sample:start` /
      // `// sample:end`; everything outside it is context that only has to
      // compile. Show the marked region, and keep the whole program one click
      // away — the markers used to render literally, so the page carried a
      // stray comment AND still showed every line it meant to fold.
      const sample = splitSample(parent.children[index].value);
      const value = sample.hasContext
        ? `<div class="noeta-sample">${render(highlighter, sample.visible)}` +
          `<details class="noeta-sample-full">` +
          `<summary>Show full example</summary>` +
          `${render(highlighter, sample.full)}` +
          `</details></div>`
        : render(highlighter, sample.full);
      parent.children[index] = { type: "html", value };
    }
  };
}
