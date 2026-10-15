import type { ReactNode } from "react";

/** A picker row in fixed columns: the name, the usage share, then a tail that stays in place from the
 * first row to the last (the English name on a non-English page, a move's facts). `share` is null
 * when the list has no usage group (no column at all) and "" on rows below it (an empty cell). */
export function OptionRow({ name, share, alias, children }: {
  name: string;
  share: string | null;
  alias: string | null;
  children?: ReactNode;
}) {
  return <span className="option-row">
    <span className="option-row-name">{name}</span>
    {share !== null && <b className="option-row-share">{share}</b>}
    {alias !== null && <small className="option-row-alias">{alias}</small>}
    {children}
  </span>;
}
