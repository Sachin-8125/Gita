import { Octokit } from "@octokit/rest";
import type { Candidate } from "./llm.js";

export const octokit: Octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

export const MARKER = "<!-- issue-triage-agent -->";

const COLORS: Record<string, string> = {
  triaged: "ededed",
  "needs-triage": "fbca04",
  "needs-info": "d876e3",
  "possible-duplicate": "cfd3d7",
  security: "b60205",
  spam: "000000",
};
const prefixColor = (l: string) =>
  l.startsWith("type:")
    ? "1d76db"
    : l.startsWith("severity:")
      ? "e99695"
      : l.startsWith("area:")
        ? "0e8a16"
        : "ededed";

const labelCache = new Map<string, Set<string>>();

async function ensureLabels(owner: string, repo: string, wanted: string[]) {
  const key = `${owner}/${repo}`;
  if (!labelCache.has(key)) {
    const existing = await octokit.paginate(
      octokit.rest.issues.listLabelsForRepo,
      { owner, repo, per_page: 100 },
    );
    labelCache.set(key, new Set(existing.map((l) => l.name)));
  }
  const have = labelCache.get(key)!;
  for (const name of wanted) {
    if (have.has(name)) continue;
    try {
      await octokit.rest.issues.createLabel({
        owner,
        repo,
        name,
        color: COLORS[name] ?? prefixColor(name),
      });
    } catch (e: any) {
      if (e.status !== 422) throw e; // 422 = already exists (race)
    }
    have.add(name);
  }
}

export async function getIssue(owner: string, repo: string, number: number) {
  return (await octokit.rest.issues.get({ owner, repo, issue_number: number }))
    .data;
}

export async function findCandidates(
  owner: string,
  repo: string,
  number: number,
  title: string,
): Promise<Candidate[]> {
  const terms = title
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 8)
    .join(" ");
  if (!terms) return [];
  try {
    const { data } = await octokit.rest.search.issuesAndPullRequests({
      q: `repo:${owner}/${repo} is:issue ${terms}`,
      per_page: 10,
    });
    return data.items
      .filter((i) => i.number !== number)
      .slice(0, 8)
      .map((i) => ({
        number: i.number,
        title: i.title,
        state: i.state,
        snippet: i.body ?? "",
      }));
  } catch {
    return [];
  }
}

export async function hasMarkerComment(
  owner: string,
  repo: string,
  number: number,
) {
  const comments = await octokit.paginate(octokit.rest.issues.listComments, {
    owner,
    repo,
    issue_number: number,
    per_page: 100,
  });
  return comments.some((c) => c.body?.includes(MARKER));
}

export async function applyPlan(
  owner: string,
  repo: string,
  number: number,
  plan: { labels: string[]; comment: string | null; assignees: string[] },
) {
  await ensureLabels(owner, repo, plan.labels);
  await octokit.rest.issues.addLabels({
    owner,
    repo,
    issue_number: number,
    labels: plan.labels,
  });
  if (plan.comment) {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: number,
      body: `${plan.comment}\n\n${MARKER}`,
    });
  }
  if (plan.assignees.length) {
    await octokit.rest.issues.addAssignees({
      owner,
      repo,
      issue_number: number,
      assignees: plan.assignees,
    });
  }
}
