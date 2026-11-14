import { describe, expect, it } from "vitest";
import { MAX_HANDLE_LENGTH, availableHandle, handleFromName } from "@/domain/handle";

describe("handleFromName", () => {
  it("lowercases, strips accents and joins words with dashes", () => {
    expect(handleFromName("Jonathan Guaynora")).toBe("jonathan-guaynora");
    expect(handleFromName("  María José Ñúñez ")).toBe("maria-jose-nunez");
  });

  it("falls back when the name has no usable characters", () => {
    expect(handleFromName("★★★")).toBe("musico");
    expect(handleFromName("")).toBe("musico");
  });

  it("stays within the length limit without a trailing dash", () => {
    const handle = handleFromName("Wolfgang Amadeus Mozart y la Orquesta Filarmónica");
    expect(handle.length).toBeLessThanOrEqual(MAX_HANDLE_LENGTH);
    expect(handle.endsWith("-")).toBe(false);
  });
});

describe("availableHandle", () => {
  it("uses the plain handle when it is free", async () => {
    expect(await availableHandle("Ana", async () => false)).toBe("ana");
  });

  it("appends -2, -3... when taken", async () => {
    const taken = new Set(["ana", "ana-2"]);
    expect(await availableHandle("Ana", async (h) => taken.has(h))).toBe("ana-3");
  });

  it("keeps suffixed handles within the length limit", async () => {
    const name = "a".repeat(40);
    const handle = await availableHandle(name, async (h) => h === "a".repeat(MAX_HANDLE_LENGTH));
    expect(handle).toBe(`${"a".repeat(MAX_HANDLE_LENGTH - 2)}-2`);
  });
});
