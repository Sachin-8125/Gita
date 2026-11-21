import { triageIssue } from "./triage.js";

const [slug, num, ...flags] = process.argv.slice(2);
if (!slug?.includes("/") || !num) {
  console.error("usage: npm run triage -- owner/repo <issue-number> [--apply]");
  process.exit(1);
}
const separator = slug.indexOf("/");
const owner = slug.slice(0, separator);
const repo = slug.slice(separator + 1);
const result = await triageIssue(owner, repo, Number(num), { dryRun: !flags.includes("--apply") });
console.log(JSON.stringify(result, null, 2));
