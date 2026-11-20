import { z } from "zod";

export const TYPES = [
    "bug",
    "feature",
    "question",
    "docs",
    "security",
    "spam",
] as const;
export const SEVERITIES = ["critical", "high", "medium", "low"] as const;

export const TriageSchema = z.object({
    type: z.enum(TYPES),
    severity: z.enum(SEVERITIES).nullable(),
    area: z.string().nullable(),
    summary: z.string().max(400),
    confidence: z.number().min(0).max(1),
    missing_info: z.array(z.string()).max(5),
    duplicate_of: z.number().int().nullable(),
    duplicate_confidence: z.number().min(0).max(1),
    reasoning: z.string().max(800),
});

export type Triage = z.infer<typeof TriageSchema>;

export const toolInputSchema = z.object({
    type: "object" as const,
    properties: {
        type: { type: "string", enum: [...TYPES] },
        severity: {
            type: ["string", "null"],
            enum: [...SEVERITIES, null],
            description: "Impact if this is a bug/security issue. null for non-bugs.",
        },
        area: {
            type: ["string", "null"],
            description: "Exactly one configured area name, or null if unclear.",
        },
        summary: {
            type: "string",
            description: "One neutral sentence, max 300 chars.",
        },
        confidence: {
            type: "number",
            minimum: 0,
            maximum: 1,
            description: "Confidence in type+area.",
        },
        missing_info: {
            type: "array",
            items: { type: "string" },
            description:
                "Specific things the reporter must add for a bug to be actionable (max 5). Empty if none.",
        },
        duplicate_of: {
            type: ["integer", "null"],
            description:
                "Issue number from CANDIDATES only, if clearly the same problem. Else null.",
        },
        duplicate_confidence: { type: "number", minimum: 0, maximum: 1 },
        reasoning: {
            type: "string",
            description: "Brief internal rationale for maintainers' audit log.",
        },
    },
    required: [
        "type",
        "severity",
        "area",
        "summary",
        "confidence",
        "missing_info",
        "duplicate_of",
        "duplicate_confidence",
        "reasoning",
    ],
});