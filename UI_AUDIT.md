# Samiksha UI audit

Reviewed on 13 Nov 2026 against Apple's interface principles (the `apple-design` skill: response, direct manipulation,
interruptibility, springs, materials, typography, the eight foundations). Every page was read in code and looked at
live: landing `/`, council `/s/INFY` (stage, "Report, page by page", "Full briefing") and share `/s/INFY/share`,
desktop and phone width.

Severity: **P0** = breaks trust or the core promise · **P1** = clearly wrong, users notice · **P2** = polish.

---

## 1. Your five points (all confirmed)

### 1.1 The agents on the stage are blank tablets · P1
`CouncilStage.tsx` draws every agent as the same rounded box in a different colour. Nothing says "Fundamentals",
"Bull" or "Risk" except the label underneath. The motion around them is good (the pulse, the link line, pages flying
in, the spark when an agent finishes); the bodies are the problem.

**Fix:** a family of nine 2D robot characters, one per agent, drawn as SVG in the Neel & Haldi palette and built with
the logo-design skill so they share one grid, stroke and corner radius. Each needs four states: asleep (waiting),
working (eyes moving, antenna pulsing), done (a check on the chest, a short happy bounce) and failed. First ideas:

| Agent | Character idea |
|---|---|
| Fundamentals | A boxy ledger bot with a calculator-key chest and reading glasses |
| Earnings call | A headset bot with a mic arm and a little waveform on its screen-face |
| News | A tall antenna bot with a folded newspaper hat |
| The Bull | A neel bot with two short horn antennae, leaning forward |
| The Bear | A haldi bot with round ear-dishes and a heavier, grounded body |
| Bull replies / Bear replies | The same Bull and Bear, smaller, each with a speech bubble |
| Risk | A bot with a visor and a shield on its arm |
| The Chief | Stays the 3D logo in the centre, the chair of the council |

These are the same marks the cards, report pages and trace use (see 1.3), so each agent looks the same everywhere.

### 1.2 The "Done" chip is noisy and inconsistent · P1
`StatusChip` puts React Bits' LatticeLoader (a 3×3 dot grid) inside a mint pill. When an agent finishes, the dot grid
stays beside "Done", so it reads as a stray "⁘" glyph, and the pill is taller than the card title next to it. Worse,
the page shows a status in **five different ways**:

1. a dot plus ShinyText in the header pill
2. a check plus a count on the stage labels
3. the lattice chip on the cards
4. StatusMark in the run trace
5. the Stepper rail

**Fix:** one `StatusBadge` used everywhere, with four states and one icon set (Hugeicons is already installed):
waiting (hollow ring, muted), working (a small spinning arc), done (a check) and failed (a cross). Same height as a
line of body text, no background pill on cards, and a time only on live runs. The header keeps a single status line
and drops the Stepper, because the stage already shows which round is running.

### 1.3 Every section logo is a single capital letter · P1
`Avatar` shows F, E, N, B, B, C, R. The Bull and the Bear are both "B", so they can't be told apart without colour.

**Fix:** use the robot heads from 1.1 as the avatars, cropped to a circle. That makes one icon family across the
stage, the card headers, the report-page kickers, the page tabs and the trace rows.

### 1.4 "What to watch" lights up on hover but clicking does nothing · P1
That list is React Bits AnimatedList. It has a hover highlight, an orange "selected" border and arrow-key navigation,
but the items are plain strings with nowhere to go. It breaks Apple's *Familiarity* rule: anything that looks
interactive must be interactive.

The same false promise shows up in other places:
- The BorderGlow edge light follows the cursor on every analyst card and on the three landing cards. None of them
  can be clicked.
- The landing "01/02/03" cards change colour and grow their haldi bar on hover.
- The firewall numbers replay their roll on hover.

AnimatedList also fades its rows by scroll position, so the first row was nearly invisible when the panel first came
into view.

**Fix:** "What to watch" becomes a plain static list. Hover effects stay only on things that do something: buttons,
links, tabs, citation pills. I'd remove BorderGlow from the cards, or keep it on a single card at most.

### 1.5 The type doesn't feel right · P1
Measured on the council page: three families in nine sizes, all in fixed pixels (26 arbitrary `text-[11px]` /
`text-[15px]`-style classes). The underlying problems:

- **Mono is overused.** IBM Plex Mono at 11–12px carries 36 labels: kickers, status, citations, evidence chips,
  "page 1 of 7", "What to watch" and section numbers. It makes a reading product look like a developer tool, and 11px
  is below a comfortable size.
- **Paragraphs are set in the display face.** The Chief's bottom line is five lines of Space Grotesk at about 2rem.
  Space Grotesk has quirky shapes (the "y", the "g", the tight curves) that suit a headline but are tiring over a
  paragraph.
- **Tracking ignores size.** Large headings range from −0.045em to −0.02em with no system behind them, and small mono
  labels add `tracking-wide`.
- **Pixel sizes ignore the reader's text-size setting.** Apple's most-missed rule; the fix is a find-and-replace to
  `rem`.

**Fix:** a real type system with two families:

- One sans for everything: Inter, using its optical-size axis, so headings get the tighter "Display" cut on their own.
  Space Grotesk then stays only in the logo wordmark. The alternative is to keep Space Grotesk for headings 32px and
  up, with Inter for everything else including the bottom line.
- Mono only for numbers that line up, plus tickers.
- Six steps in `rem`, each with its own tracking and leading: display, title, heading, body, small, caption.
- Kickers become small caps in the sans, not mono.

---

## 2. Landing page `/`

| # | Sev | Finding | Fix |
|---|---|---|---|
| L1 | **P0** | The firewall section is hard-coded at "40 passed, 3 blocked, from the TCS briefing", and the three struck-out examples are hard-coded too. Today's TCS briefing actually says **41 passed, 1 blocked**. A product whose promise is "every claim, cited" shows a stale claim on its own homepage. | Read the numbers and examples from the cached TCS briefing (or `/health`) at load time. |
| L2 | P1 | FoldText headings ("Seven analysts. Three rounds…" and "Our own AI made things up…") are tied to scroll. Mid-scroll they sit half-folded: "balanced" skewed and ghosted, words missing. People read while they scroll, so the heading is unreadable at the moment they look at it. | A one-time fade-and-rise on entry, then the text sits still. |
| L3 | P1 | The hero's VariableProximity runs an **idle wave**: the H1's weight wobbles forever. That is the slow looping oscillation Apple warns against, and it pulls the eye from the input. | Drop the idle wave. Keep the cursor effect at most, or drop it too. |
| L4 | P1 | The hero 3D logo is decoration: it never connects to what you do. | Make it the doorway. Pressing "Convene the council" carries the logo into the council page's stage (a shared-element move), so the hero logo is the same object that runs the council. |
| L5 | P2 | The firewall numbers show **0 and 0** until scrolled into view, and a screenshot caught them that way. | Start the roll from the real numbers' neighbourhood, or show the final value when motion is reduced. |
| L6 | P2 | "Pick a stock ↑" scrolls to the top but doesn't focus the input. | Focus the ticker field after scrolling. |
| L7 | P2 | The "Educational. Not investment advice." pill in the nav has a button's shape but isn't one. | Make it plain small text, or a link to a short "why" note. |
| L8 | P2 | The marquee never stops. | Pause it on hover and on focus; it already stops under reduced motion. |

## 3. Council page `/s/[ticker]`

| # | Sev | Finding | Fix |
|---|---|---|---|
| C1 | P1 | See 1.1–1.3: the tablets, the five status styles and the letter avatars. | Robots, `StatusBadge`, robot-head avatars. |
| C2 | P1 | **The report sheet runs the full 1,230px width**, about 150 characters per line. Comfortable reading is 60–75. | Cap the sheet text at about 68ch and centre the sheet. It will look more like paper too. |
| C3 | P1 | **The page turn doesn't follow your finger.** Drag is clamped (`dragConstraints 0`, elastic 0.12), so the sheet barely moves, then flips on release only past 80px. It ignores velocity, so a quick flick does nothing. A flip in progress can't be grabbed, and fast clicks queue up. | Track the drag 1:1 by tying the page's rotation to the drag distance. Decide on release from the velocity's sign plus a projected position. Finish on a spring that starts at the finger's velocity (damping 1, response 0.35). |
| C4 | P1 | **On a phone the stage collapses.** The nav wraps to three lines, labels overlap ("Earnings call", "Fundamentals" and "News" stack), and the ring is too wide for 390px. | On narrow screens, lay the robots out in rows: 3 researchers on top, Bull and Bear in the middle, Risk at the bottom, with the logo in between. Put the nav on one line. |
| C5 | P1 | Citation pills are 20px tall; Apple's minimum touch target is 44px. On touch, tapping a pill opens the source PDF in a new tab instead of showing the quote card, so the "see the exact line" moment is skipped on phones. | Pad the hit area to 44px (invisible). First tap opens the card; the card holds the "Open the source page" link. |
| C6 | P2 | The header stacks three separate status readouts: the pill, "5 of 9 agents done · 0:12" and the Stepper. | One line: badge, "Debate · 5 of 9 · 0:12". |
| C7 | P2 | In Full briefing, the Bull and Bear reply columns have different lengths, which leaves a large blank area, and the Risk card stretches to the Chief's height with empty space below. | Align the cards to the top (`items-start`), and pair each reply directly under the point it answers. |
| C8 | P2 | The evidence chip ("●●● Corroborated" in 10.5px mono) uses the same dot language as the loader, so two unrelated things look alike. | A 3-segment bar in the sans at caption size. |
| C9 | P2 | Two layers of tabs, plus Previous/Next, plus page-pills, plus the arrow-key hint: four ways to move through seven pages. | Keep the page pills and Previous/Next, and move the keyboard hint into the button tooltips. |
| C10 | P2 | The "Read the report ↓" button only appears after the run. During the run, nothing tells you the pages are already filling in below. | Show a quiet "3 pages ready ↓" counter while the council is running. |

## 4. Share page `/s/[ticker]/share`

The cleanest page on the site: one sheet, footnotes, a source list, print styles. Small items:

- The Copy link button only copies. On phones, the native share sheet (`navigator.share`) is what people expect.
- The header and metric chips are 11px mono; follow the new type scale.
- The bottom line is set in the display face at 1.55rem (see 1.5).

## 5. Site-wide

| # | Sev | Finding | Fix |
|---|---|---|---|
| S1 | P1 | **Ten React Bits effects compete:** FoldText, ShinyText, VariableProximity, BorderGlow, CountUp, ScrollReveal, AnimatedList, LatticeLoader, StatusMark and Stepper. Each brings its own motion language, so nothing feels designed as one product. That breaks Apple's Craft and Simplicity rules. | Keep a few brand motifs and cut the rest:<br>• **the haldi highlighter sweep:** "cited", quotes, the ScrollReveal statement<br>• **pages flying into the logo:** the stage<br>• **the page turn:** the report<br>• **numbers that roll:** CountUp, used once per page<br>• **ShinyText, maybe:** for the live status only<br>Remove FoldText, VariableProximity, BorderGlow, AnimatedList, Stepper and LatticeLoader. |
| S2 | P1 | **Motion is long, fixed-duration tweens**: 0.6–1.1s ease-out-expo, with a 6px blur on every reveal. It feels slow, and none of it can be interrupted. | Springs for UI (damping 1, response 0.3–0.4). Reveals of at most 0.4s, with the blur only on the hero. |
| S3 | P1 | **Press feedback exists only on the primary button.** Chips, tabs, page pills and Previous/Next don't react to the press. | `active:scale-[0.97]` with a 100ms transition on every pressable thing. |
| S4 | P2 | Colour meanings overlap. Haldi means "the Bear", "a highlighted/cited quote" and "blocked by the firewall", so the Bear reads like a warning. | Use haldi for the Bear and for highlights only. The firewall gets its own deep amber/red tone, which `--color-firewall` already is; just stop reusing haldi for the blocked chips and strike-throughs. |
| S5 | P2 | Reduced motion is handled for CSS and most of the motion library. Reduced transparency and higher contrast are not. | Add `prefers-reduced-transparency` (a solid nav, no blur) and `prefers-contrast: more` (solid borders). |
| S6 | P2 | The sticky nav's blur sits over a 0.8-alpha ground, which is fine, but the dark firewall section scrolls under it and the nav turns grey (seen in the screenshots). | Give the nav a slightly stronger material, or switch the nav to its dark style while it is over the dark section. |

---

## 6. Suggested order of work

1. **Truth first:** L1, the live firewall numbers on the landing page.
2. **Identity:** robots plus the icon family (1.1, 1.3), then `StatusBadge` (1.2, C6).
3. **Type system:** the rem scale, the family decision and mono only for numbers (1.5, the share page).
4. **Cut the effects:** S1, which also settles 1.4, L2 and L3, plus S3.
5. **Reading and touch:** C2, C3, C5, C4.
6. **Everything P2.**

## 7. Decisions (made 13 Nov 2026)

- **Robots:** flat 2D SVG robots, and the whole stage goes 2D (the centre logo becomes the 2D mark, same animations).
- **Type:** Inter only, using optical sizes for headings; mono only for numbers and tickers.
- **Effects:** remove FoldText, VariableProximity, BorderGlow, AnimatedList, Stepper and LatticeLoader. Keep the
  highlighter sweep, the flying pages, the page turn and the number roll.

### The original questions

1. **Robot style:** flat 2D SVG (crisp, light, easy to animate) or 2.5D with soft shading? Should the stage stay 3D
   (robots as flat cut-outs around the 3D logo) or go fully 2D?
2. **Type:** Inter only (one family, optical sizes), or Space Grotesk kept for big headings only?
3. **Effects:** is it OK to remove FoldText, VariableProximity, BorderGlow, AnimatedList, Stepper and LatticeLoader,
   keeping the highlighter, the flying pages, the page turn and the number roll?
