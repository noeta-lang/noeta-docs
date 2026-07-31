/**
 * Populates `content/docs/` from the noeta repo's `docs/` directory. Runs as
 * the predev/prebuild hook so `pnpm dev` and `pnpm build` work without manual
 * setup.
 *
 * Two sources, in order of preference:
 *   1. A local sibling checkout (`../lang/docs`, or $NOETA_DOCS_LOCAL) — the
 *      normal development setup, always freshly copied (cheap).
 *   2. A blobless sparse `git` clone of the hosted repo — CI and machines
 *      without the language checkout. No token needed for a public repo, and
 *      `--filter=blob:none --sparse` fetches only the docs/ blobs.
 *
 * After the docs sync, sync-para.mjs adds one page per para-* library (from
 * their READMEs) plus a "Para libraries" sidebar section — see that file for
 * its sources and env knobs.
 *
 * Env:
 *   NOETA_DOCS_LOCAL   — path to a local docs/ dir (default: ../lang/docs
 *                        relative to this repo, used when it exists)
 *   NOETA_DOCS_REPO    — GitHub repo for the clone fallback
 *                        (default noeta-lang/noeta)
 *   NOETA_DOCS_REF     — branch or tag to pull docs/ from (default main)
 *   NOETA_SKIP_SYNC=1  — short-circuit entirely; require existing content/docs/
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, readdir, rename, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { syncParaLibs } from "./sync-para.mjs";
import { syncStdDocs } from "./sync-std.mjs";
import { syncDiagnostics } from "./sync-diagnostics.mjs";

const repoRoot = process.cwd();
const docsDir = resolve(repoRoot, "content", "docs");
const tmpDir = resolve(repoRoot, "content", "docs.tmp");

const LOCAL = process.env.NOETA_DOCS_LOCAL ?? resolve(repoRoot, "..", "lang", "docs");
const REPO = process.env.NOETA_DOCS_REPO ?? "noeta-lang/noeta";
const REF = process.env.NOETA_DOCS_REF ?? "main";

async function haveDocs() {
  if (!existsSync(docsDir)) return false;
  try {
    return (await readdir(docsDir)).some((f) => f.endsWith(".md"));
  } catch {
    return false;
  }
}

async function syncFromLocal() {
  console.log(`[sync-docs] Copying docs/ from local checkout ${LOCAL}`);
  await rm(tmpDir, { recursive: true, force: true });
  await cp(LOCAL, tmpDir, { recursive: true });
  await rm(docsDir, { recursive: true, force: true });
  await rename(tmpDir, docsDir);
}

function syncFromClone() {
  console.log(`[sync-docs] Cloning docs/ from ${REPO}@${REF}`);
  execFileSync(
    "git",
    ["clone", "--depth", "1", "--branch", REF, "--filter=blob:none", "--sparse", `https://github.com/${REPO}.git`, tmpDir],
    { stdio: ["ignore", "inherit", "inherit"] },
  );
  execFileSync("git", ["-C", tmpDir, "sparse-checkout", "set", "docs"], {
    stdio: ["ignore", "inherit", "inherit"],
  });
}

if (process.env.NOETA_SKIP_SYNC === "1") {
  if (!(await haveDocs())) {
    console.error("[sync-docs] FATAL: NOETA_SKIP_SYNC=1 but content/docs/ is empty");
    process.exit(1);
  }
  console.log("[sync-docs] Skipping (NOETA_SKIP_SYNC=1); using existing content/docs/");
  process.exit(0);
}

try {
  if (existsSync(LOCAL)) {
    await syncFromLocal();
  } else {
    await rm(tmpDir, { recursive: true, force: true });
    syncFromClone();
    const checkedOut = resolve(tmpDir, "docs");
    if (!existsSync(checkedOut)) throw new Error(`docs/ not found in ${REPO}@${REF}`);
    await rm(docsDir, { recursive: true, force: true });
    await rename(checkedOut, docsDir);
    await rm(tmpDir, { recursive: true, force: true });
  }
  const mdCount = (await readdir(docsDir)).filter((f) => f.endsWith(".md")).length;
  console.log(`[sync-docs] Synced ${mdCount} .md files into ${docsDir}`);
} catch (err) {
  await rm(tmpDir, { recursive: true, force: true });
  if (await haveDocs()) {
    console.warn(`[sync-docs] WARNING: ${err.message}; using existing local content/docs/`);
  } else {
    console.error(`[sync-docs] FATAL: ${err.message}`);
    process.exit(1);
  }
}

// The generated sections are additive — a failure loses those pages but must
// not take the docs build down with it. Std first, then para: each appends its
// own sidebar section, and this order is the order they render in.
try {
  syncStdDocs();
} catch (err) {
  console.warn(`[sync-std] WARNING: ${err.message}; building without the std reference`);
}
try {
  await syncParaLibs();
} catch (err) {
  console.warn(`[sync-para] WARNING: ${err.message}; building without para library pages`);
}
try {
  syncDiagnostics();
} catch (err) {
  console.warn(`[sync-diagnostics] WARNING: ${err.message}; building without the diagnostics reference`);
}
