// Remark plugin: GitHub-style alerts. A blockquote whose first line is `[!NOTE]` (or TIP /
// IMPORTANT / WARNING / CAUTION) becomes a titled callout `<div class="alert alert-note">…`,
// styled in docs.css. GFM parses the `[!NOTE]` marker as ordinary text, so without this the marker
// renders literally — this strips it, tags the block, and prepends a title. A blockquote that isn't
// an alert (e.g. the docs' lead quote) is left untouched.

const TYPES = new Set(["note", "tip", "important", "warning", "caution"]);
const TITLE = (t) => t.charAt(0).toUpperCase() + t.slice(1);

function transformAlert(bq) {
  const para = bq.children[0];
  if (!para || para.type !== "paragraph" || !para.children.length) return;
  const lead = para.children[0];
  if (!lead || lead.type !== "text") return;

  const m = /^\[!(note|tip|important|warning|caution)\][ \t]*/i.exec(lead.value);
  if (!m) return;
  const type = m[1].toLowerCase();
  if (!TYPES.has(type)) return;

  // Drop the marker. In the canonical form the marker is alone on the first line, so the text node
  // is left empty and followed by a soft break — remove both; the inline form leaves trailing text.
  lead.value = lead.value.slice(m[0].length);
  if (lead.value === "") {
    para.children.shift();
    if (para.children[0] && para.children[0].type === "break") para.children.shift();
  }
  if (para.children.length === 0) bq.children.shift();

  // Render as a div, not a blockquote, with a title. hName/hProperties are the standard
  // mdast→hast escape hatch; the title rides as a raw html node (same approach as remark-noeta-code).
  bq.data = bq.data || {};
  bq.data.hName = "div";
  bq.data.hProperties = { className: ["alert", `alert-${type}`] };
  bq.children.unshift({ type: "html", value: `<p class="alert-title">${TITLE(type)}</p>` });
}

function walk(node) {
  if (!node || !Array.isArray(node.children)) return;
  for (const child of node.children) {
    if (child.type === "blockquote") transformAlert(child);
    walk(child);
  }
}

export default function remarkAlerts() {
  return (tree) => walk(tree);
}
