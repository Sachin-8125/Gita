import { audit, notifySlack } from "./audit.js";
import { config, env } from "./config.js";
import {
  applyPlan,
  findCandidates,
  getIssue,
  hasMarkerComment,
} from "./github.js";
import { classify } from "./llm.js";
import { decide } from "./policy.js";

const SKIP_LABELS = ["triaged"];

export async function triageIssue(
  owner: string,
  repo: string,
  number: number,
  opts: { dryRun?: boolean } = {},
) {
  const dryRun = opts.dryRun ?? env.dryRun;
  const issue = await getIssue(owner, repo, number);
  const ref = `${owner}/${repo}#${number}`;

  const labelNames = issue.labels.map((l) =>
    typeof l === "string" ? l : (l.name ?? ""),
  );
  if (issue.pull_request) return skip(ref, "is a PR");
  if (issue.user?.type === "Bot") return skip(ref, "bot author");
  if (issue.locked) return skip(ref, "locked");
  if (labelNames.some((l) => SKIP_LABELS.includes(l)))
    return skip(ref, "already triaged");
  if (await hasMarkerComment(owner, repo, number))
    return skip(ref, "already commented");

  const author = issue.user?.login ?? "there";
  const candidates = await findCandidates(owner, repo, number, issue.title);
  const { triage, usage, ms } = await classify({
    title: issue.title,
    body: issue.body ?? "",
    author,
    candidates,
  });
  const plan = decide(triage, { number, author, candidates }, config);

  if (!dryRun) await applyPlan(owner, repo, number, plan);
  if (plan.notify) {
    await notifySlack(
      env.slackWebhook,
      `🚨 ${plan.reason} issue: https://github.com/${owner}/${repo}/issues/${number}`,
    );
  }

  await audit({
    ref,
    dryRun,
    model: env.model,
    ms,
    usage,
    triage,
    plan,
    candidates: candidates.map((c) => c.number),
  });
  console.log(
    `[${ref}] ${dryRun ? "DRY " : ""}${plan.labels.join(", ")} (${plan.reason}, ${ms}ms)`,
  );
  return { ref, triage, plan, dryRun };
}

async function skip(ref: string, why: string) {
  console.log(`[${ref}] skipped: ${why}`);
  await audit({ ref, skipped: why });
  return null;
}
