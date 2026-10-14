const LIGATURES: Readonly<Record<string, string>> = { Œ: 'OE', Æ: 'AE' };

/** Uppercase, accents removed, ligatures expanded: "Cœur à l'été" → "COEUR A L'ETE". */
export function normalizeText(text: string): string {
  return text
    .toUpperCase()
    .replace(/[ŒÆ]/g, (ligature) => LIGATURES[ligature] ?? ligature)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** True when the text is only letters A to Z: no space, hyphen, apostrophe or digit. */
export function isPlainWord(text: string): boolean {
  return /^[A-Z]+$/.test(text);
}
