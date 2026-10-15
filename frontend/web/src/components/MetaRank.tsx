import "./styles.metarank.css";

function rankTier(rank: number): "S" | "A" | "B" | "C" | "D" {
  if (rank <= 10) return "S";
  if (rank <= 30) return "A";
  if (rank <= 60) return "B";
  if (rank <= 100) return "C";
  return "D";
}

export function RankBadge({ rank }: { rank: number }) {
  return <span className={`rank-badge num tier-${rankTier(rank)}`}>{rank}</span>;
}

/** Rank differences keep their direction in the arrow; the magnitude steps from a coloured number to
 * a tinted pill to a pill with a double arrow. Sampling noise softens the colour without hiding the
 * magnitude. "=" is an unchanged rank; "–" means the other side gives no rank to compare (the title
 * says why). */
export function RankDeltaChip({ delta, minor, title, className = "" }: {
  delta: number | null;
  minor?: boolean;
  title: string;
  className?: string;
}) {
  if (delta == null) {
    return <span className={`rank-dl none ${className}`} title={title} aria-label={title}>–</span>;
  }
  if (delta === 0) {
    return <span className={`rank-dl flat ${className}`} title={title} aria-label={title}>=</span>;
  }
  const degree = Math.abs(delta) < 10 ? "small" : Math.abs(delta) < 30 ? "medium" : "large";
  const arrow = delta > 0 ? "▲" : "▼";
  return (
    <span className={`rank-dl ${delta > 0 ? "up" : "down"}${minor ? " minor" : ""} ${className}`}
          data-degree={degree} title={title} aria-label={title}>
      <span className="ar" aria-hidden="true">{degree === "large" ? arrow + arrow : arrow}</span>{Math.abs(delta)}
    </span>
  );
}

/** The ranking card's Top Meta share (or team count below five), beside the type icons. */
export function ShareTag({ text }: { text: string }) {
  return <span className="top-share">{text}</span>;
}
