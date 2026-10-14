/** The home page's stage: the localized brand and two ways in — online here, or installed locally.
 * Repository and mirror links live with the installation instructions. The art is drawn from the
 * site's own data language and needs no data request and no sprite, so the first screen still paints
 * from the handshake alone. The snapshot date lives in the top bar, not here. */
import { Link } from "react-router-dom";
import { IconArrowDown, IconArrowRight } from "@tabler/icons-react";
import { useT } from "../../i18n.ts";
import { Phrases } from "./Phrases.tsx";
import { WorkbenchArt } from "./WorkbenchArt.tsx";

export function Hero({ online, start }: { online: boolean; start: string }) {
  const t = useT();
  return (
    <header className="home-stage home-hero">
      <div className="home-hero-copy">
        {/* One heading, read as "brand · product"; the product is drawn above the brand as its label. */}
        <h1>
          <span className="home-hero-brand"><Phrases text={t("home.title.brand")} /></span>
          <span className="sr-only"> · </span>
          <span className="home-hero-product">
            <i className="home-hero-core" aria-hidden="true" />
            <span><Phrases text={t("home.title.product")} /></span>
          </span>
        </h1>
        <p className="home-hero-accent"><Phrases text={t("home.title.accent")} /></p>
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
