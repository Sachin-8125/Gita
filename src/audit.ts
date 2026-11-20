import { appendFile, mkdir } from "node:fs/promises";

export async function audit(record: Record<string, unknown>) {
    await mkdir("data", { recursive: true });
    await appendFile("data/audit.jsonl", JSON.stringify({ ts: new Date().toISOString(), ...record }) + "\n");
}

export async function notifySlack(url: string | null, text: string) {
    if (!url) return;
    try {
        await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
    } catch (e) {
        console.error("slack notify failed", e);
    }
}