/** The home page's stage: what the site is (the open-source skills, their repository and its mirror one
 * click away) and the two ways in — online here, or installed locally. The art is drawn from the
 * site's own data language and needs no data request and no sprite, so the first screen still paints
 * from the handshake alone. The snapshot date lives in the top bar, not here. */
import { Link } from "react-router-dom";
import { IconArrowDown, IconArrowRight, IconBrandGithub } from "@tabler/icons-react";
import { useT } from "../../i18n.ts";
import { WorkbenchArt } from "./WorkbenchArt.tsx";

export const REPO_URL = "https://github.com/pmwl0128/Turn_Zero_Skills";
export const MIRROR_URL = "https://gitee.com/pmwl0128/pokemon_champion_agent";

export function Hero({ online, start }: { online: boolean; start: string }) {
  const t = useT();
  return (
    <header className="home-stage home-hero">
      <div className="home-hero-copy">
        <div className="home-demo-pill">
          <span className="home-demo-dot" aria-hidden="true" />
          <span className="home-demo-name">{t("home.demo.pill")}</span>
          <a className="home-demo-gh" href={REPO_URL} target="_blank" rel="noreferrer">
            <IconBrandGithub aria-hidden="true" />GitHub
          </a>
          <a className="home-demo-gh" href={MIRROR_URL} target="_blank" rel="noreferrer">
            <span className="home-gitee-mark" aria-hidden="true">G</span>Gitee
          </a>
        </div>
        <h1>
          <span className="home-hero-name">{t("home.title")}</span>
          <span className="home-hero-accent">{t("home.title.accent")}</span>
        </h1>
        <div className="home-hero-actions">
          <Link className="home-cta primary" to={start}>
            {t(online ? "home.cta.online" : "home.cta.open")}<IconArrowRight aria-hidden="true" />
          </Link>
          {online && (
            <a className="home-cta" href="#home-install">
              {t("home.cta.install")}<IconArrowDown aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
      <WorkbenchArt />
    </header>
  );
}
