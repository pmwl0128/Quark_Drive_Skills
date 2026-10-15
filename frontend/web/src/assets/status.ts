/** User-supplied battle-status icons, bundled locally with the UI. */
import burn from "../../../assets/status-icons/burn_icon.webp?url";
import freeze from "../../../assets/status-icons/freeze_icon.webp?url";
import paralysis from "../../../assets/status-icons/paralysis_icon.webp?url";
import poison from "../../../assets/status-icons/poison_icon.png?url";
import sleep from "../../../assets/status-icons/sleep_icon.png?url";

export const STATUS_ICONS: Readonly<Record<string, string>> = {
  Burned: burn,
  Frozen: freeze,
  Paralyzed: paralysis,
  Poisoned: poison,
  "Badly Poisoned": poison,
  Asleep: sleep,
};
