/** Display copy set in phrases. Chinese and Japanese have no spaces to break at, so a large heading
 * either breaks inside a word or not at all; the copy names its own break points instead: "|" marks
 * where a line may break and "[…]" an emphasised run. Each phrase stays whole; in English it wraps as
 * usual. */
import { Fragment, type ReactNode } from "react";

/** The copy as words only, for labels and anything else that is not the heading itself. */
export const plainText = (text: string) => text.replace(/[|[\]]/g, "");

function marks(text: string): ReactNode[] {
  return text.split(/(\[[^\]]*\])/).filter(Boolean).map((part, i) =>
    part.startsWith("[") && part.endsWith("]") ? <mark key={i}>{part.slice(1, -1)}</mark> : part);
}

export function Phrases({ text }: { text: string }) {
  return text.split("|").map((phrase, i) => {
    // Edge spaces stay outside the phrase: inside an inline-block a trailing space would be dropped.
    const [, lead, body, trail] = /^(\s*)(.*?)(\s*)$/s.exec(phrase)!;
    return (
      <Fragment key={i}>
        {i > 0 && <wbr />}
        {lead}
        <span className="home-phrase">{marks(body!)}</span>
        {trail}
      </Fragment>
    );
  });
}
