import express from "express";
import { Webhooks } from "@octokit/webhooks";
import { env } from "./config.js";
import { triageIssue } from "./triage.js";

class Queue {
  private running = 0;
  private items: Array<() => Promise<unknown>> = [];
  constructor(private max: number) {}
  push(fn: () => Promise<unknown>) {
    this.items.push(fn);
    this.drain();
  }
  private drain() {
    while (this.running < this.max && this.items.length) {
      const fn = this.items.shift()!;
      this.running++;
      fn()
        .catch((e) => console.error("triage failed:", e))
        .finally(() => {
          this.running--;
          this.drain();
        });
    }
  }
}

const queue = new Queue(env.concurrency);
const webhooks = new Webhooks({
  secret: process.env.GITHUB_WEBHOOK_SECRET ?? "",
});

webhooks.on("issues.opened", ({ payload }) => {
  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  if (env.allowedRepos.length && !env.allowedRepos.includes(`${owner}/${repo}`))
    return;
  queue.push(() => triageIssue(owner, repo, payload.issue.number)); // enqueue only; ack GitHub fast
});

const app = express();
app.get(
  "/healthz",
  (_req, res) =>
    void res.json({ ok: true, dryRun: env.dryRun, model: env.model }),
);

app.post(
  "/webhook",
  express.text({ type: "*/*", limit: "5mb" }),
  async (req, res) => {
    try {
      await webhooks.verifyAndReceive({
        id: req.header("x-github-delivery") ?? "",
        name: (req.header("x-github-event") ?? "") as never,
        signature: req.header("x-hub-signature-256") ?? "",
        payload: req.body as string,
      });
      res.status(202).end();
    } catch {
      res.status(401).end(); // bad signature
    }
  },
);

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () =>
  console.log(
    `triage agent on :${port} (dryRun=${env.dryRun}, model=${env.model})`,
  ),
);
