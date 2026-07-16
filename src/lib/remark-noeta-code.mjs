// Remark plugin: renders ```noeta / ```noe fences with the shared @noeta/theme
// highlighter instead of shiki (which has no Noeta grammar and would fall back
// to unstyled plaintext with a build warning). Emitting a raw html node here
// means shiki never sees these blocks; every other language stays on shiki.

import { highlightNoeta } from "@noeta/theme/highlight";

function walk(node) {
  if (!node || !Array.isArray(node.children)) return;
  node.children = node.children.map((child) => {
    if (child.type === "code" && (child.lang === "noeta" || child.lang === "noe")) {
      return {
        type: "html",
        value: `<pre class="noeta-code"><code>${highlightNoeta(child.value)}</code></pre>`,
      };
    }
    walk(child);
    return child;
  });
}

export default function remarkNoetaCode() {
  return (tree) => walk(tree);
}
