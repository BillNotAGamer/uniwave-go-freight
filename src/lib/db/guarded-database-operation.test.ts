import { describe, expect, it, vi } from "vitest";

import { runGuardedDatabaseOperation } from "./guarded-database-operation";

describe("guarded database operation orchestration", () => {
  it("does not call a migration operation when authorization fails", async () => {
    const operation = vi.fn();

    await expect(
      runGuardedDatabaseOperation({
        authorize: () => {
          throw new Error("not authorized");
        },
        operation,
      }),
    ).rejects.toThrow("not authorized");

    expect(operation).not.toHaveBeenCalled();
  });

  it("does not call cleanup deletes when authorization fails", async () => {
    const cleanupDeletes = vi.fn();

    await expect(
      runGuardedDatabaseOperation({
        authorize: () => {
          throw new Error("not authorized");
        },
        operation: cleanupDeletes,
      }),
    ).rejects.toThrow("not authorized");

    expect(cleanupDeletes).not.toHaveBeenCalled();
  });

  it("allows the operation after authorization succeeds", async () => {
    const operation = vi.fn().mockResolvedValue("ok");

    await expect(
      runGuardedDatabaseOperation({
        authorize: () => undefined,
        operation,
      }),
    ).resolves.toBe("ok");

    expect(operation).toHaveBeenCalledOnce();
  });
});
