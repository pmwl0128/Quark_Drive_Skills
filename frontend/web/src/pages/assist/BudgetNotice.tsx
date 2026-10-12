/** What a page shows when the day's model budget is spent (product roadmap §1.8): when it comes
 * back, and the tools that never needed it. Links follow capabilities, so a deployment without the
 * diagnosis endpoint does not offer it. */
import { Link } from "react-router-dom";
import { useLang, type Lang } from "../../i18n.ts";
import { useRuntime } from "../../runtime/context.tsx";
import { useAssistT } from "./messages.ts";

const LOCALES: Record<Lang, string> = { zh: "zh-CN", en: "en", ja: "ja-JP" };

/** The budget is booked per UTC day, so it returns at the next UTC midnight; shown in local time. */
function resetTime(lang: Lang, now = new Date()): string {
  const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return reset.toLocaleTimeString(LOCALES[lang], { hour: "2-digit", minute: "2-digit" });
}

export function BudgetNotice() {
  const t = useAssistT();
  const { lang } = useLang();
  const { can } = useRuntime();
  return (
    <div className="notice budget-notice" role="status">
      <p className="budget-notice-title">{t("budget.title")}</p>
      <p>{t("budget.reset").replace("{time}", resetTime(lang))}</p>
      <p>
        {t("budget.tools")}
        <span className="budget-notice-links">
          {can("team.validate") && <Link to="/assist?tab=diagnose">{t("budget.diagnose")}</Link>}
          <Link to="/calc">{t("nav.calc")}</Link>
          <Link to="/ranking">{t("nav.ranking")}</Link>
          <Link to="/dex">{t("nav.dex")}</Link>
        </span>
      </p>
    </div>
  );
}
