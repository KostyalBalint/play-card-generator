/** Bijective base-26 label: 0→A, 25→Z, 26→AA, 27→AB, … */
export function labelForIndex(i: number): string {
  let n = i + 1;
  let s = "";
  while (n > 0) {
    n--;
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}

/** Text shown on a card's generic back: explicit override, else the position label. */
export function buildBackText(card: { backText?: string | null; positionLabel?: string | null }): string {
  return card.backText?.trim() || card.positionLabel || "";
}

/** Alter-prompt to bake a back's label/text onto an existing back image (reuses buildEditPrompt). */
export function backAlterPrompt(card: { backText?: string | null; positionLabel?: string | null }): string {
  const text = buildBackText(card);
  return text
    ? `Change the label/text on the card to read exactly: "${text}". Keep everything else identical.`
    : "Keep everything identical.";
}
