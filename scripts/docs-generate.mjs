import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { format } from "prettier";

const root = process.cwd();
const outputPath = path.join(root, "docs/generated/domain-identifiers.md");
const schema = await readFile(path.join(root, "prisma/schema.prisma"), "utf8");
const optionsSource = await readFile(
  path.join(root, "app/types/campaign-options.ts"),
  "utf8",
);

function enumValues(name) {
  const match = schema.match(new RegExp(`enum ${name} \\{([\\s\\S]*?)\\n\\}`));
  if (!match) throw new Error(`Missing Prisma enum ${name}`);

  return match[1]
    .split("\n")
    .map(
      (line) =>
        line
          .replace(/\/\/.*$/, "")
          .trim()
          .split(/\s+/)[0],
    )
    .filter(Boolean);
}

function optionRecords(name) {
  const match = optionsSource.match(
    new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\n\\] as const;`),
  );
  if (!match) throw new Error(`Missing option registry ${name}`);

  return [...match[1].matchAll(/\{([\s\S]*?)\}/g)].map((record) => {
    const value = record[1].match(/value:\s*"([^"]+)"/)?.[1];
    const label = record[1].match(/label:\s*"([^"]+)"/)?.[1];
    const description = record[1].match(/description:\s*"([^"]+)"/)?.[1];
    if (!value || !label) throw new Error(`Invalid record in ${name}`);
    return { value, label, description: description ?? "" };
  });
}

function assertSameSet(name, actual, expected) {
  const left = [...actual].sort().join("\n");
  const right = [...expected].sort().join("\n");
  if (left !== right) {
    throw new Error(`${name} option values do not match the Prisma enum`);
  }
}

const campaignTypes = optionRecords("campaignTypeOptions");
const placements = optionRecords("placementTypeOptions");
assertSameSet(
  "Campaign type",
  campaignTypes.map((item) => item.value),
  enumValues("CampaignType"),
);
assertSameSet(
  "Placement",
  placements.map((item) => item.value),
  enumValues("PlacementType"),
);

const generatedMarkdown = [
  "# Generated domain identifiers",
  "",
  "> GENERATED FILE — do not edit. Run `npm run docs:generate`. Sources: `prisma/schema.prisma` and `app/types/campaign-options.ts`.",
  "",
  "The generator also verifies that campaign-type and placement option registries contain exactly the corresponding Prisma enum values. Capability support is intentionally documented in the manually reviewed [campaign capability matrix](../campaign-types/capability-matrix.md).",
  "",
  "## Campaign types",
  "",
  "| Identifier | Admin label |",
  "| --- | --- |",
  ...campaignTypes.map((item) => `| \`${item.value}\` | ${item.label} |`),
  "",
  "## Campaign goals",
  "",
  ...enumValues("CampaignGoal").map((value) => `- \`${value}\``),
  "",
  "## Placements",
  "",
  "| Identifier | Admin label | Description |",
  "| --- | --- | --- |",
  ...placements.map(
    (item) =>
      `| \`${item.value}\` | ${item.label} | ${item.description || "—"} |`,
  ),
  "",
  "## Timer modes",
  "",
  ...enumValues("TimerMode").map((value) => `- \`${value}\``),
  "",
  "## Timer expiration behaviors",
  "",
  ...enumValues("TimerExpiredBehavior").map((value) => `- \`${value}\``),
  "",
  "## Analytics events",
  "",
  ...enumValues("AnalyticsEventType").map((value) => `- \`${value}\``),
  "",
].join("\n");
const output = await format(generatedMarkdown, { parser: "markdown" });

if (process.argv.includes("--check")) {
  const current = await readFile(outputPath, "utf8").catch(() => "");
  if (current !== output) {
    console.error(
      "Generated documentation is stale. Run npm run docs:generate.",
    );
    process.exitCode = 1;
  }
} else {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, output, "utf8");
  console.log("Generated docs/generated/domain-identifiers.md");
}
