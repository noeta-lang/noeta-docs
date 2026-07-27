// Doc-sample context folding: `// sample:start` / `// sample:end`.
//
// A doc sample has to be a *complete program* — the doc-sample gate in the lang
// repo runs every ```noeta fence through the real `noeta` binary, which is what
// keeps the documentation honest. But complete and readable pull against each
// other: showing a struct, three imports and a helper just so a two-line call
// compiles buries the point. So a block may mark the region worth reading, and
// everything outside it is compiled but folded behind an expander.
//
// This is a deliberate PORT of `noeta-ide::sample::split` (crates/noeta-ide/
// src/sample.rs), not a fresh implementation: the VS Code docs browser, `noeta
// doc`, and this site must agree on where a block splits, or the same page
// reads differently depending on where you open it. Keep the two in step — the
// semantics below mirror that module case for case, including the fallbacks.

const START = "// sample:start";
const END = "// sample:end";

/**
 * Split `code` into the region a reader is shown and the whole program.
 *
 * Unmarked code is returned whole and unfolded. A `// sample:start` with no
 * matching `// sample:end` shows everything after it — a half-marked block
 * still renders something useful rather than collapsing to nothing. Multiple
 * marked regions are concatenated in order, so a page can show two interesting
 * stretches of one program and fold the plumbing between them. The markers
 * themselves never appear in either output.
 *
 * @param {string} code
 * @returns {{ visible: string, full: string, hasContext: boolean }}
 */
export function splitSample(code) {
  const visible = [];
  const full = [];
  let showing = false;
  let sawMarker = false;

  for (const line of code.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === START) {
      showing = true;
      sawMarker = true;
      continue;
    }
    if (trimmed === END) {
      showing = false;
      sawMarker = true;
      continue;
    }
    full.push(line);
    if (showing) visible.push(line);
  }

  const fullText = full.join("\n");
  if (!sawMarker) {
    return { visible: fullText, full: fullText, hasContext: false };
  }
  const visibleText = visible.join("\n");
  // A marked block whose region is empty would render as a blank code box; fall
  // back to the whole thing, which is worse for brevity but never worse than
  // showing nothing.
  if (visibleText.trim() === "") {
    return { visible: fullText, full: fullText, hasContext: false };
  }
  return { visible: visibleText, full: fullText, hasContext: visibleText !== fullText };
}

/**
 * Strip the markers from a whole markdown document, leaving every code block
 * complete.
 *
 * For the raw `/<slug>.md` endpoints, which serve source to agents and curl:
 * folding there would hand a reader code that does not compile, so the full
 * program stays — only the markers, which are noise to anything but a viewer,
 * come out. Applied line-wise over the document rather than per fence, since a
 * marker line is unambiguous anywhere.
 *
 * @param {string} markdown
 * @returns {string}
 */
export function stripSampleMarkers(markdown) {
  if (!markdown.includes(START) && !markdown.includes(END)) return markdown;
  return markdown
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      return t !== START && t !== END;
    })
    .join("\n");
}
