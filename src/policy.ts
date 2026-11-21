import type { Config } from "./config.js";
import type { Candidate } from "./llm.js";
import type { Triage } from "./schema.js";

export interface Plan {
  labels: string[];
  comment: string | null;
  assignees: string[];
  notify: boolean;
  reason: string;
}

export const clean = (s: string, max = 200) =>
  s.replace(/@/g, "@\u200b").replace(/https?:\/\/\S+/gi, "[link removed]").replace(/\s+/g, " ").trim().slice(0, max);

const FOOTER = "<sub>🤖 Triaged automatically — a maintainer will review. Wrong label? Just change it.</sub>";

export function decide(
  t: Triage,
  issue: { number: number; author: string; candidates: Candidate[] },
  cfg: Config,
): Plan {
  if (t.confidence < cfg.confidenceThreshold) {
    return { labels: ["needs-triage"], comment: null, assignees: [], notify: false, reason: "low confidence → human review" };
  }

  if (t.type === "security") {
    return {
      labels: ["triaged", "security"],
      comment:
        "Thanks for the report. This may be security-sensitive. If it includes exploit details, please edit them out and " +
        "report privately via this repository's **Security → Report a vulnerability** page. A maintainer has been notified.\n\n" + FOOTER,
      assignees: [],
      notify: true,
      reason: "security",
    };
  }

  if (t.type === "spam") {
    return { labels: ["triaged", "spam"], comment: null, assignees: [], notify: false, reason: "spam/abuse (no auto-close)" };
  }

  const labels = ["triaged", `type:${t.type}`];
  if (t.severity && t.type === "bug") labels.push(`severity:${t.severity}`);

  const area = cfg.areas.find((a) => a.name === t.area);
  if (area) labels.push(`area:${area.name}`);

  const parts: string[] = [];

  if (t.type === "bug" && t.missing_info.length) {
    labels.push("needs-info");
    parts.push(
      `Thanks for the report, @${issue.author}! To help us reproduce this, could you add:\n` +
        t.missing_info.map((m) => `- ${clean(m)}`).join("\n"),
    );
  }

  const dupOk =
    t.duplicate_of !== null &&
    t.duplicate_of !== issue.number &&
    t.duplicate_confidence >= cfg.duplicateThreshold &&
    issue.candidates.some((c) => c.number === t.duplicate_of); // guards against hallucinated issue numbers
  if (dupOk) {
    labels.push("possible-duplicate");
    parts.push(`This looks related to #${t.duplicate_of}. A maintainer will confirm whether it's a duplicate.`);
  }

  const assignees =
    cfg.assignOwners && area && area.owners.length ? [area.owners[issue.number % area.owners.length]!] : [];

  return {
    labels,
    comment: parts.length ? parts.join("\n\n") + "\n\n" + FOOTER : null,
    assignees,
    notify: t.severity === "critical",
    reason: "ok",
  };
}
