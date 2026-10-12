import { expect, test } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LangContext, type Lang } from "../i18n.ts";
import { buildSourceOrigin, tuneSourceOrigin, SetOriginBadge } from "./SetOrigin.tsx";

test("a Meta fallback or an estimate never reads as a real-team set", () => {
  expect(buildSourceOrigin("aggregate")).toBe("real-team");
  expect(buildSourceOrigin("meta")).toBe("meta");
  expect(buildSourceOrigin("custom")).toBe("custom");
  expect(["real-team", "real-team+meta-spread", "meta", "explicit", "synthetic", undefined, "future"]
    .map(tuneSourceOrigin)).toEqual(["real-team", "real-team", "meta", "custom", "estimate", "estimate", "estimate"]);
});

test.each<Lang>(["zh", "en", "ja"])("a metagame SP splice is disclosed in %s", (lang) => {
  const render = (metaSpread: boolean) => renderToStaticMarkup(createElement(LangContext.Provider,
    { value: { lang, setLang: () => {} } },
    createElement(SetOriginBadge, { origin: "real-team", metaSpread })));
  const observed = render(false);
  const mixed = render(true);
  expect(mixed).not.toBe(observed);
  expect(mixed).toContain("origin-real-team");
  const disclosures = { zh: "尚未确认", en: "has not been confirmed", ja: "確認されていません" };
  expect(mixed).toContain(disclosures[lang]);
});
