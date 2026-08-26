import { describe, expect, it } from "vitest";
import { JsonLogger } from "../src/observability/logger.js";

describe("JSON logger", () => {
  it("emits structured context and safe error fields", () => {
    const lines: string[] = [];
    const logger = new JsonLogger("info", { service: "test" }, (line) => lines.push(line));
    logger.child({ requestId: "req-1" }).error("failed", { error: new Error("boom") });
    const record = JSON.parse(lines[0]!) as Record<string, unknown>;
    expect(record).toMatchObject({ level: "error", message: "failed", service: "test", requestId: "req-1" });
    expect(record.error).toMatchObject({ name: "Error", message: "boom" });
  });

  it("filters records below the configured level", () => {
    const lines: string[] = [];
    const logger = new JsonLogger("warn", {}, (line) => lines.push(line));
    logger.info("ignored");
    logger.warn("kept");
    expect(lines).toHaveLength(1);
  });
});

