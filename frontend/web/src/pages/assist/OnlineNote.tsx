/** The assist page's header note: what the online version is, and a way to the local agent (the home
 * page's install section) for fuller results. Its own module, so the page shell loads it without the
 * tabs' workspace code. */
import { Link } from "react-router-dom";
import { useAssistT } from "./messages.ts";

export function OnlineNote() {
  const t = useAssistT();
  const [before, after = ""] = t("online.aiNote").split("{install}");
  return <>{before}<Link to="/#home-install" className="online-note-link">{t("online.aiNote.install")}</Link>{after}</>;
}
