/** The wizard's model-free answer when the day's budget is spent: the reference skeletons and the
 * candidate pool a build would have started from. It is labelled as a preview throughout and offers
 * no team actions, because nothing here was assembled, validated or pressure-tested. */
import type { BuilderPreviewDto } from "@pokemon-champions/protocol";
import { EntityHover } from "../../components/EntityHover.tsx";
import { useDexByName } from "../../hooks.ts";
import { displayName, useLang } from "../../i18n.ts";
import { useAssistT } from "./messages.ts";

const TIERS = ["anchor", "core", "partner"] as const;

function SpeciesChips({ names }: { names: string[] }) {
  const { lang } = useLang();
  const dex = useDexByName();
  return (
    <span className="gate-detail-chips">
      {names.map((name, i) => {
        const entry = dex.get(name);
        return (
          <EntityHover key={`${name}-${i}`} kind="pokemon" name={name}>
            <span className="gate-chip" title={name}>{entry ? displayName(entry, lang) : name}</span>
          </EntityHover>
        );
      })}
    </span>
  );
}

export function BuilderPreview({ preview }: { preview: BuilderPreviewDto }) {
  const t = useAssistT();
  return (
    <div className="panel builder-result diag-section builder-preview">
      <h2>{t("preview.title")}</h2>
      <p className="muted">{t("preview.note")}</p>
      {preview.skeletons.map((skeleton, i) => (
        <section key={i} className="gate-detail builder-preview-skeleton">
          <h3>{t("preview.skeleton").replace("{n}", String(i + 1))}</h3>
          {TIERS.map((tier) => {
            const names = skeleton.core.filter((c) => c.tier === tier).map((c) => c.species);
            return names.length > 0 && (
              <div key={tier} className="gate-detail-row">
                <span className="gate-detail-label">{t(`preview.tier.${tier}`)}</span>
                <SpeciesChips names={names} />
              </div>
            );
          })}
          {skeleton.openSlots > 0 && (
            <p className="muted">{t("preview.open").replace("{n}", String(skeleton.openSlots))}</p>
          )}
        </section>
      ))}
      <div className="gate-detail">
        {preview.candidates.length > 0 && (
          <div className="gate-detail-row">
            <span className="gate-detail-label">{t("preview.candidates")}</span>
            <SpeciesChips names={preview.candidates} />
          </div>
        )}
        {preview.megaOptions.length > 0 && (
          <div className="gate-detail-row">
            <span className="gate-detail-label">{t("preview.megas")}</span>
            <SpeciesChips names={preview.megaOptions} />
          </div>
        )}
      </div>
    </div>
  );
}
