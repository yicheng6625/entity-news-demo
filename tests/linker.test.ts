import { describe, expect, it } from "vitest";
import { linkEntities, type LinkableEntity, type Segment } from "@/lib/linker";

// 把 segment 還原成易讀字串，讓斷言直接看出「哪段文字被連到哪裡」
const render = (paras: Segment[][]) =>
  paras.map((segs) => segs.map((s) => (s.type === "link" ? `[${s.text}](${s.href})` : s.text)).join(""));

const kestrel: LinkableEntity = { key: "company:1", href: "/n/company/kestrine-bio", names: ["Kestrine Biosystems", "Kestrine"] };
const mara: LinkableEntity = { key: "executive:1", href: "/n/executive/mara-v", names: ["Mara Vantreese"] };

describe("linkEntities", () => {
  it("只連結第一次出現，即使跨段落", () => {
    const out = render(linkEntities(["Kestrine Biosystems rose.", "Later, Kestrine Biosystems fell."], [kestrel]));
    expect(out).toEqual(["[Kestrine Biosystems](/n/company/kestrine-bio) rose.", "Later, Kestrine Biosystems fell."]);
  });

  it("長名稱優先，別名不會吃掉全名的前半段", () => {
    const out = render(linkEntities(["Kestrine Biosystems said Kestrine will grow."], [kestrel]));
    expect(out[0]).toBe("[Kestrine Biosystems](/n/company/kestrine-bio) said Kestrine will grow.");
  });

  it("別名在全名之前出現時，別名就是第一次提及", () => {
    const out = render(linkEntities(["Kestrine shares jumped; Kestrine Biosystems confirmed."], [kestrel]));
    expect(out[0]).toBe("[Kestrine](/n/company/kestrine-bio) shares jumped; Kestrine Biosystems confirmed.");
  });

  it("不在單字中間比對（Kestrineville 不是 Kestrine）", () => {
    const out = render(linkEntities(["Kestrineville is a town."], [kestrel]));
    expect(out[0]).toBe("Kestrineville is a town.");
  });

  it("所有格與標點旁仍可正確比對", () => {
    const out = render(linkEntities(["Mara Vantreese's plan (Kestrine) worked."], [kestrel, mara]));
    expect(out[0]).toBe("[Mara Vantreese](/n/executive/mara-v)'s plan ([Kestrine](/n/company/kestrine-bio)) worked.");
  });

  it("區分大小寫，避免把一般單字誤連成實體", () => {
    const apple: LinkableEntity = { key: "company:2", href: "/x", names: ["Orchard"] };
    expect(render(linkEntities(["An orchard near Orchard HQ."], [apple]))[0]).toBe("An orchard near [Orchard](/x) HQ.");
  });

  it("遵守 maxLinks 與 excludeKeys", () => {
    const paras = ["Mara Vantreese leads Kestrine."];
    expect(render(linkEntities(paras, [kestrel, mara], { maxLinks: 1 }))[0]).toBe("[Mara Vantreese](/n/executive/mara-v) leads Kestrine.");
    expect(render(linkEntities(paras, [kestrel, mara], { excludeKeys: ["executive:1"] }))[0]).toBe(
      "Mara Vantreese leads [Kestrine](/n/company/kestrine-bio).",
    );
  });

  it("名稱含正則特殊字元時不會出錯", () => {
    const weird: LinkableEntity = { key: "company:3", href: "/w", names: ["A+B (Holdings)"] };
    expect(render(linkEntities(["Deal with A+B (Holdings) closed."], [weird]))[0]).toBe("Deal with [A+B (Holdings)](/w) closed.");
  });

  it("沒有實體時原樣回傳", () => {
    expect(linkEntities(["plain"], [])).toEqual([[{ type: "text", text: "plain" }]]);
  });
});
