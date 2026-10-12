/** The closing stage: this site is the online demo of the open-source skills, what the full local
 * agent adds, and the three ways to install it (each copyable). Shown in the online runtime only —
 * a local runtime already runs on the installed skills. Commands are the project README's own. */
import { useEffect, useState } from "react";
import { IconBrandGithub, IconCheck, IconCopy, IconDownload } from "@tabler/icons-react";
import { useT, type MsgKey } from "../../i18n.ts";
import { MIRROR_URL, REPO_URL } from "./Hero.tsx";
import { SegmentedControl, segmentedPanelId, segmentedTabId } from "../../components/SegmentedControl.tsx";

type Way = "cli" | "plugin" | "agent";
const WAYS: Way[] = ["cli", "plugin", "agent"];

const COMMANDS: Record<Exclude<Way, "agent">, string> = {
  plugin: "/plugin marketplace add pmwl0128/Turn_Zero_Skills\n/plugin install pokemon-champions@pmwl",
  cli: "npx skills add pmwl0128/Turn_Zero_Skills -g",
};

const ROWS: Array<[MsgKey, MsgKey]> = [
  ["home.install.online.scope", "home.install.local.scope"],
  ["home.install.online.build", "home.install.local.build"],
  ["home.install.online.model", "home.install.local.model"],
  ["home.install.online.files", "home.install.local.files"],
];

export function Install() {
  const t = useT();
  const [way, setWay] = useState<Way>("cli");
  const [copied, setCopied] = useState(false);
  const textOf = (id: Way) => id === "agent" ? t("home.install.agentPrompt") : COMMANDS[id];
  useEffect(() => setCopied(false), [way]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(textOf(way));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked: the text is selectable as it stands */ }
  };

  return (
    <section id="home-install" className="home-stage home-install" aria-labelledby="home-install-heading">
      <div className="home-install-copy">
        <h2 id="home-install-heading">{t("home.install.title")}</h2>
        <p>{t("home.install.body")}</p>
        <table className="home-compare">
          <thead>
            <tr><th scope="col">{t("home.install.col.online")}</th><th scope="col">{t("home.install.col.local")}</th></tr>
          </thead>
          <tbody>
            {ROWS.map(([online, local]) => (
              <tr key={online}><td>{t(online)}</td><td>{t(local)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="home-install-box">
        <SegmentedControl kind="tabs" idBase="home-install" value={way} onChange={setWay}
          className="home-install-tabs" ariaLabel={t("home.install.title")}
          items={WAYS.map((id) => ({ id, label: t(`home.install.tab.${id}`) }))} />
        {/* All three panes share one grid cell, so switching never changes the box's height. */}
        <div className="home-install-panes">
          {WAYS.map((id) => (
            <div key={id} role="tabpanel" id={segmentedPanelId("home-install", id)}
              aria-labelledby={segmentedTabId("home-install", id)} hidden={way !== id}>
              <div className="home-install-code">
                <pre>{textOf(id)}</pre>
                <button type="button" className="home-copy" onClick={() => void copy()}>
                  {copied && way === id ? <IconCheck aria-hidden="true" /> : <IconCopy aria-hidden="true" />}
                  {t(copied && way === id ? "home.install.copied" : "home.install.copy")}
                </button>
              </div>
              <p className="home-install-hint">{t(`home.install.hint.${id}`)}</p>
            </div>
          ))}
        </div>
        <div className="home-install-links">
          <a href={REPO_URL} target="_blank" rel="noreferrer"><IconBrandGithub aria-hidden="true" />{t("home.install.repo")}</a>
          <a href={MIRROR_URL} target="_blank" rel="noreferrer">
            <span className="home-gitee-mark" aria-hidden="true">G</span>{t("home.install.mirror")}
          </a>
          <a href={`${REPO_URL}/releases/tag/data-latest`} target="_blank" rel="noreferrer">
            <IconDownload aria-hidden="true" />{t("home.install.ui")}
          </a>
          <p className="home-install-ui">{t("home.install.uiNote")}</p>
        </div>
      </div>
    </section>
  );
}
