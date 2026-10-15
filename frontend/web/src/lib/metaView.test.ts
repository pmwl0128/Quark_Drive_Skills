import { describe, expect, it } from "vitest";
import { fromView, readMetaView, withMetaView } from "./metaView.ts";

describe("metagame view", () => {
  it("reads one Top Meta record from both perspectives with opposite signs", () => {
    expect(fromView(20.2, "top")).toBe(20.2);
    expect(fromView(20.2, "ingame")).toBe(-20.2);
    expect(fromView(null, "ingame")).toBeNull();
  });

  it("compares by default only in the Top Meta view", () => {
    expect(readMetaView(new URLSearchParams("")).compare).toBe(false);
    expect(readMetaView(new URLSearchParams("src=top")).compare).toBe(true);
    expect(readMetaView(new URLSearchParams("src=top&scope=rule")).compare).toBe(true);
    expect(readMetaView(new URLSearchParams("cmp=1")).compare).toBe(true);
  });

  it("switching the source starts that view at its own default", () => {
    const on = withMetaView(new URLSearchParams("format=double"), { compare: true });
    expect(on.get("cmp")).toBe("1");
    const top = withMetaView(on, { source: "top" });
    expect(top.get("src")).toBe("top");
    expect(top.get("cmp")).toBeNull();
    expect(top.get("format")).toBe("double");
  });
});
