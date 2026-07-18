import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const ignoredDirectories = new Set([
  ".git",
  ".shopify",
  ".cache",
  ".react-router",
  "node_modules",
  "build",
  "dist",
  "generated",
  "playwright-report",
  "playwright-report-real",
  "test-results",
]);
const errors = [];

async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await markdownFiles(absolute)));
    else if (entry.isFile() && entry.name.endsWith(".md"))
      result.push(absolute);
  }
  return result;
}

function localLinkTargets(markdown) {
  return [...markdown.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)]
    .map((match) => match[1].trim().replace(/^<|>$/g, ""))
    .filter(
      (target) =>
        target &&
        !target.startsWith("#") &&
        !/^[a-z][a-z0-9+.-]*:/i.test(target),
    )
    .map((target) => decodeURIComponent(target.split("#")[0]));
}

function documentedRepositoryPaths(markdown) {
  return [...markdown.matchAll(/`([^`]+)`/g)]
    .map((match) => match[1])
    .filter((target) =>
      /^(app|prisma|extensions|theme-extension-src|tests|scripts|docs|public)\//.test(
        target,
      ),
    )
    .filter(
      (target) =>
        !target.includes("*") && !target.includes("<") && !target.includes(" "),
    );
}

for (const file of await markdownFiles(root)) {
  const markdown = await readFile(file, "utf8");
  for (const target of localLinkTargets(markdown)) {
    const resolved = path.resolve(path.dirname(file), target);
    if (!resolved.startsWith(root + path.sep) && resolved !== root) {
      errors.push(
        `${path.relative(root, file)}: link escapes repository: ${target}`,
      );
      continue;
    }
    try {
      await access(resolved);
    } catch {
      errors.push(
        `${path.relative(root, file)}: missing link target: ${target}`,
      );
    }
  }
  for (const target of documentedRepositoryPaths(markdown)) {
    try {
      await access(path.join(root, target));
    } catch {
      errors.push(
        `${path.relative(root, file)}: missing documented path: ${target}`,
      );
    }
  }
}

const requiredHeadings = new Map([
  [
    "AGENTS.md",
    [
      "# Promo Pulse agent guide",
      "## Sources of truth",
      "## Definition of done",
    ],
  ],
  [
    "docs/INDEX.md",
    ["# Documentation index", "## Task router", "## Maintenance"],
  ],
  ["docs/glossary.md", ["# Glossary", "## Maintenance"]],
]);
for (const [relative, headings] of requiredHeadings) {
  const content = await readFile(path.join(root, relative), "utf8").catch(
    () => "",
  );
  for (const heading of headings) {
    if (!content.includes(heading))
      errors.push(`${relative}: missing ${heading}`);
  }
}

const generated = spawnSync(
  process.execPath,
  ["scripts/docs-generate.mjs", "--check"],
  {
    cwd: root,
    encoding: "utf8",
  },
);
if (generated.status !== 0) {
  errors.push((generated.stderr || generated.stdout).trim());
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    "Documentation links, structure, registries, and generated files are valid.",
  );
}
