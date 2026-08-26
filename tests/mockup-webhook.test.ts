import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { PrintfulMockupWebhookService } from "../src/mockups/webhook-service.js";

describe("Printful mockup webhook", () => {
  it("verifies, stores and wakes a waiting task", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValue({});
    const release = vi.fn();
    const pool = { connect: vi.fn().mockResolvedValue({ query, release }) } as never;
    const secret = Buffer.alloc(32, 7);
    const raw = Buffer.from(JSON.stringify({ type: "mockup_task_finished", occurred_at: "2026-08-05T00:00:00Z", retries: 0, store_id: 12, data: { id: 597350033, status: "completed" } }));
    const result = await new PrintfulMockupWebhookService(pool, secret.toString("hex"), "pub").receive(raw, { signature: createHmac("sha256", secret).update(raw).digest("hex"), publicKey: "pub" });
    expect(result).toEqual({ accepted: true, duplicate: false, matchedJobs: 1 });
    expect(query.mock.calls.some((call) => String(call[0]).includes("remote_task_ids @>"))).toBe(true);
    expect(release).toHaveBeenCalled();
  });
  it("rejects an invalid signature", async () => {
    const service = new PrintfulMockupWebhookService({} as never, "aa");
    await expect(service.receive(Buffer.from("{}"), { signature: "00" })).rejects.toMatchObject({ status: 401 });
  });
});
