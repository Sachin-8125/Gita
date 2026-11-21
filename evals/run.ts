import { readFileSync } from "node:fs";
import { classify } from "../src/llm.js";

type Fx = {
  name: string;
  title: string;
  body: string;
  expect: {
    type: string[];
    missingInfo?: boolean;
    notCritical?: boolean;
    noDuplicate?: boolean;
  };
};
const fixtures: Fx[] = JSON.parse(readFileSync("evals/fixtures.json", "utf8"));

let pass = 0;
for (const f of fixtures) {
  const { triage: t } = await classify({
    title: f.title,
    body: f.body,
    author: "eval",
    candidates: [],
  });
  const fails: string[] = [];
  if (!f.expect.type.includes(t.type)) fails.push(`type=${t.type}`);
  if (f.expect.missingInfo && !t.missing_info.length)
    fails.push("expected missing_info");
  if (f.expect.notCritical && t.severity === "critical")
    fails.push("severity=critical");
  if (f.expect.noDuplicate && t.duplicate_of !== null)
    fails.push(`duplicate_of=${t.duplicate_of}`);
  if (!fails.length) pass++;
  console.log(
    `${fails.length ? "FAIL" : "PASS"}  ${f.name.padEnd(24)} → ${t.type}/${t.severity}/${t.area} conf=${t.confidence} ${fails.join(", ")}`,
  );
}
console.log(`\n${pass}/${fixtures.length} passed`);
process.exit(pass === fixtures.length ? 0 : 1);