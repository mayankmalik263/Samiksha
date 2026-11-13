# Samiksha: logo kit and guidelines

> **Cited**, in the **Neel & Haldi** palette. Folded citation brackets hold three lines of a source, and the
> highlighted haldi line is the exact quote behind a claim. Samiksha never says anything without a source.

## 1. The logo

| Version | File | Use for |
|---|---|---|
| Horizontal (primary) | `logo/samiksha-horizontal.svg` | Site header, README, slides, social banners |
| Stacked | `logo/samiksha-stacked.svg` | Square-ish spaces: posters, the demo video end card |
| Symbol | `logo/samiksha-symbol.svg` | Avatars and anywhere the name is already visible |
| Symbol, small cut | `logo/samiksha-symbol-small.svg` | **Below 48 px**: favicon, app icon, tiny UI. One fat quote line instead of three |
| Wordmark only | `logo/samiksha-wordmark.svg` | Rare; when the symbol already appears nearby |
| Reversed (on Neel or dark) | `logo/*-reversed.svg`, `logo/*-white.svg` | Dark backgrounds, indigo tiles |
| One colour | `logo/*-black.svg`, `logo/*-mono-4338ca.svg` | Stamps, embossing, single-colour print |
| Web icons | `web/` | `favicon.ico/.svg`, PNGs 16 to 512 px, `apple-touch-icon`, `maskable-512`, `site.webmanifest`, `head-snippet.html` |
| PNGs | `logo/*-1200.png` | Places that cannot take SVG |
| Presentation | `presentation/board.html`, `presentation/slides/` | The design rationale and mockups |

The wordmark is **custom-drawn** (geometric lowercase with an 18-unit stroke and a 96-unit x-height). It is not a font, so
never retype "samiksha" in a typeface to imitate it. The dot of the **i** is a haldi quote line, the same element
as in the symbol.

Rebuild everything from code: `python build.py` (SVG masters), then `python render_icons.py` (PNGs and icons).

## 2. Clear space

Keep clear space of **1 × S** on every side, where **S = the width of a bracket stem** (28 of the symbol's 256 units,
about 11% of the symbol's height). Clear space scales with the logo.

## 3. Minimum size

| Version | Screen | Print |
|---|---|---|
| Horizontal | 120 px wide | 30 mm wide |
| Symbol (full) | 48 px | 12 mm |
| Symbol (small cut) | 16 px | 5 mm |

## 4. Colour: Neel & Haldi

| Name | Role | HEX | RGB | CMYK (approx.) |
|---|---|---|---|---|
| **Neel** (indigo) | Signature, bracket folds, bull case | `#4338CA` | 67 56 202 | 67 72 0 21 |
| **Haldi** (turmeric) | The quoted line, bear case (graphics) | `#D97706` | 217 119 6 | 0 45 97 15 |
| **Ink** | Brackets, wordmark, text | `#1B1835` | 27 24 53 | 49 55 0 79 |
| **Ground** | Page background | `#FBFAF6` | 251 250 246 | 0 0 2 2 |
| Haldi text | Haldi used *as text* | `#B45309` | 180 83 9 | 0 54 95 29 |
| Lilac / Amber | Reversed folds / reversed quote line | `#C7C3F4` / `#F59E0B` | | |

CMYK values are converted from RGB. Get printed proofs, and a Pantone match from your printer, before any print run.

**Contrast (measured):** Ink on Ground 16.4:1 · Neel on Ground 7.6:1 · white on Neel 7.9:1 · Haldi-text `#B45309`
on Ground 4.8:1. **Haldi `#D97706` on white is only 3.2:1, so it is for shapes, never for body text.** In the reversed logo,
amber on Neel is 3.7:1 (fine for graphics).

**Approved logo/background pairs:** full colour on Ground or white · reversed on Neel `#4338CA` · reversed on Ink
`#1B1835` · black on white · white on black.

**Product rule (SEBI):** Neel and Haldi mark the *bull* and *bear* sides of the debate. Never use green-up / red-down
anywhere in the product, because those colours read as buy and sell.

## 5. Typography

- Wordmark: custom paths (see above).
- UI headings: **Space Grotesk** 600/700. Body: **Inter** 400/500/600. Numbers and source tags: **IBM Plex Mono**.
  All three are free under the SIL Open Font License, served from Google Fonts. Fallback: `system-ui, sans-serif`.

## 6. Don'ts

Don't stretch, squash or rotate · don't recolour outside the palette · don't swap the haldi quote line for another
colour · don't add shadows, outlines, gradients or effects · don't rearrange or resize the parts of a lockup ·
don't use the three-line symbol below 48 px (use the small cut) · don't place it on busy photos without a
Ground or Neel container · don't retype the wordmark in a font.

## 7. Notes

- **Trademark:** not cleared. Run a trademark search (IP India, WIPO Global Brand Database) and a reverse image search
  before public launch.
- **Mockups:** the presentation mockups use placeholder content (a sample name, `samiksha.com`). They are not real
  contacts or a domain we own.
- Built with the `logo-design` skill (`.claude/skills/logo-design`). Every file passed its SVG audit (100/100).
