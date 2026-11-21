import "dotenv/config";

import {readFileSync} from "node:fs";
import {z} from "zod";

const Area = z.object({
    name: z.string().min(1),
    description: z.string(),
    owners: z.array(z.string()).default([]),
});

const ConfigSchema = z.object({
    areas: z.array(Area).min(1),
    confidenceThreshold: z.number().min(0).max(1).default(0.6),
    duplicateThreshold: z.number().min(0).max(1).default(0.85),
    assignOwners: z.boolean().default(false),
});

export type Config = z.infer<typeof ConfigSchema>;

export const config: Config = ConfigSchema.parse(
    JSON.parse(readFileSync(process.env.TRIAGE_CONFIG ?? "triage.config.json", "utf8"))
);

const configuredModels = (process.env.GEMINI_MODELS ?? "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);

const primaryModel = process.env.GEMINI_MODEL ?? "gemini-3.8-flash";
const models = configuredModels.length
    ? Array.from(new Set([primaryModel, ...configuredModels]))
    : [primaryModel];

export const env = {
    model: primaryModel,
    models,
    dryRun: process.env.DRY_RUN !== "false", //safe by default
    allowedRepos: (process.env.ALLOWED_REPOS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    concurrency: Number(process.env.CONCURRENCY ?? 3),
    slackWebhook: process.env.SLACK_WEBHOOK_URL || null,
};