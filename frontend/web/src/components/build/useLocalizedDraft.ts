import { useCallback, useState } from "react";

/** Keep in-progress typing, while external values/languages display their own label in the same
 * render. A vocabulary/learnset arriving later may update the label without erasing a draft. */
export function useLocalizedDraft(value: string, label: string, lang: string) {
  const [draft, setDraft] = useState<{ value: string; lang: string; text: string } | null>(null);
  const text = draft?.value === value && draft.lang === lang ? draft.text : label;
  const edit = useCallback((text: string) => setDraft({ value, lang, text }), [value, lang]);
  const reset = useCallback(() => setDraft(null), []);
  return [text, edit, reset] as const;
}
