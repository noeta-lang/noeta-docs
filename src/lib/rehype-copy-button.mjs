// Rehype plugin: wrap every code block Astro's own shiki pass produced in the shared `.snippet`
// shell, so it gets the same hover copy button as a Noeta block.
//
// The Noeta fences never reach here — `remarkNoetaCode` replaces them with raw HTML nodes during
// the remark phase and wraps them itself (it has to: only it knows whether a block folds a sample,
// and therefore which of its two blocks is the copy payload). This pass covers everything else on
// a docs page: ```console, ```toml, ```text, ```rust. Both routes emit the same markup, so one
// listener and one stylesheet serve the whole site.

import { copyButton } from "@noeta/theme/copy";

/** Parse the button markup once — it is a constant, and rehype wants hast, not a string. */
const BUTTON = {
  type: "raw",
  value: copyButton(),
};

export default function rehypeCopyButton() {
  return (tree) => {
    visit(tree, (node, index, parent) => {
      if (!parent || index === null) return;
      if (node.type !== "element" || node.tagName !== "pre") return;
      // Already wrapped (a nested pass, or markup that brought its own shell).
      if (parent.type === "element" && (parent.properties?.className ?? []).includes("snippet")) {
        return;
      }
      parent.children[index] = {
        type: "element",
        tagName: "div",
        properties: { className: ["snippet"] },
        children: [node, BUTTON],
      };
      // Skip re-visiting the node we just re-parented, or we would wrap it forever.
      return index + 1;
    });
  };
}

/**
 * A depth-first walk that lets the visitor replace the current node and say where to continue —
 * `unist-util-visit` is not a dependency of this site and this is the whole of what it needs.
 */
function visit(node, fn, index = null, parent = null) {
  const next = fn(node, index, parent);
  if (typeof next === "number") return next;
  const children = node.children;
  if (!Array.isArray(children)) return;
  for (let i = 0; i < children.length; ) {
    const skip = visit(children[i], fn, i, node);
    i = typeof skip === "number" ? skip : i + 1;
  }
}
