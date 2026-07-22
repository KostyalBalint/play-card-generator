# Bundled overlay fonts

Used for the rendered card overlays (see `lib/overlaystyle`) — embedded in the
exported PDF and served to the browser preview so screen matches print.

All files are Google Fonts releases under the SIL Open Font License 1.1
(<https://openfontlicense.org>):

| File | Family | Source |
| --- | --- | --- |
| `notosans-400.ttf`, `notosans-700.ttf` | Noto Sans | fonts.google.com/specimen/Noto+Sans |
| `notoserif-400.ttf`, `notoserif-700.ttf` | Noto Serif | fonts.google.com/specimen/Noto+Serif |
| `notomono-400.ttf`, `notomono-700.ttf` | Noto Sans Mono | fonts.google.com/specimen/Noto+Sans+Mono |
| `cinzel-400.ttf`, `cinzel-700.ttf` | Cinzel | fonts.google.com/specimen/Cinzel |
| `playfair-400.ttf`, `playfair-700.ttf` | Playfair Display | fonts.google.com/specimen/Playfair+Display |
| `imfell-400.ttf` | IM Fell English (no bold cut) | fonts.google.com/specimen/IM+Fell+English |
| `oswald-400.ttf`, `oswald-700.ttf` | Oswald | fonts.google.com/specimen/Oswald |
| `bebas-400.ttf` | Bebas Neue (no bold cut) | fonts.google.com/specimen/Bebas+Neue |
| `amatic-400.ttf`, `amatic-700.ttf` | Amatic SC | fonts.google.com/specimen/Amatic+SC |
| `specialelite-400.ttf` | Special Elite (no bold cut) | fonts.google.com/specimen/Special+Elite |
| `gloria-400.ttf` | Gloria Hallelujah (no bold cut) | fonts.google.com/specimen/Gloria+Hallelujah |

The Noto trio backs the plain "sans / serif / mono" choices. PDF's built-in
Helvetica / Times / Courier would need no file at all, but they are WinAnsi-only
and throw on Latin Extended-A (`ő`, `ł`), which failed whole exports — they are
now only a last-resort fallback if a bundled file cannot be read.

Adding a family: drop the TTF here, add an entry to `FONT_CATALOG`
(`lib/overlaystyle.ts`) and an `@font-face` block to `app/globals.css`, then
export a PDF and *look at it*. pdf-lib's subsetter silently drops glyphs on some
faces and its full-file path crashes on others, which is why `FontFiles.subset`
is set per family.
