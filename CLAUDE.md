# AG Records: Anika Giri's portfolio

## Concept

AG Records is a record label where nothing ships until it's checked. Anika is the mastering engineer: the last stage before release, catching what's wrong while there's still time. That is what her projects do (double-blind catches evaluations that lie, tripwire catches actions an agent was tricked into, cloudscape catches incidents before they become post-mortems). Every project is a release with a catalog number (AG-001, AG-002). Ag is the symbol for silver, so the label is silver. Physical media only: vinyl, labels, liner notes, sleeves. No streaming-app references.

The record is the interface. A turntable fills the first screen, each release is a band on the record cut from its commit history, and the tonearm is the navigation: scroll moves the needle, clicking a band drops it there. A plain tracklist exists only as the fallback for reduced motion and no JavaScript.

## Stack

Astro, static output. Waveforms are generated at build time from each repo's git history, filtered to Anika's own commits. Project clips are short muted looping .webm/.mp4, not GIFs.

## Writing rules

- Never use em dashes or en dashes anywhere in site copy. Use periods, commas, colons, or parentheses.
- No marketing filler ("passionate," "innovative," "leveraging"). Short and specific.
- No emoji. No "Hi, I'm Anika" hero.
- Do not add code comments unless asked.

## Visual rules

The target mood is a printed, photographed record sleeve: light grainy paper, one framed photograph, one giant word. The reference is a monochrome album cover with a framed image, tracked caps in the corners, a barcode sticker and an ultra-heavy word across the bottom. Match its energy, never its layout or content.

- Ground: light paper around #ECECEA with grain over the whole page. No dark UI.
- Monochrome base: ink around #1A1A1A, greys in between. Color appears in two places only: the small vermillion dot (#E8442E) on the needle, and one rounded card per release, wrapping its stack line, one-liner, brief and links, in that release's own muted spot color, chosen to sit with the greys rather than shout over them (tripwire soft vermillion #E99A80, double-blind slate #A7BCCD, algoscope sage #A9C5A3, cloudscape ochre #E3C98A). All text inside a card is ink. Each card has a thin ink outline, a hard ink offset shadow with soft depth beneath it, and a light sheen; it lifts into place when a release becomes active. No backdrop blur. No commit counts and no QC lines on the page. Focus rings, links and active states are ink.
- The turntable lives inside a framed panel with rounded corners and a thin ink outline: black vinyl on a pale grey mat, soft grain, a slight glow at the edges, so it reads as photographed, not rendered.
- One ultra-wide, ultra-heavy word runs edge to edge across the bottom and overlaps the frame's bottom edge. It is the active release name (home state: AG Records), carries a rough ink texture, and is fitted to the full width every time.
- Printed details, slightly rotated: a barcode sticker with a peeling corner carrying the catalog number, and a price-tag date. No rubber stamps: Anika does not like them.
- The tracklist is printed-looking release names with dotted leaders, not boxed tabs.
- The back catalogue is three record-store crates side by side, one per job. Each crate is a stack of sleeves you flip through: the job's cover first, then one sleeve per thing done there. Below 64rem the crates become a horizontal scroll row. Without JavaScript the sleeves render as a plain readable list.
- Back catalogue copy comes from Anika's resume. Do not add figures that are not on it.
- A slim sticky header runs across the whole page: Anika's name on the left, GitHub, LinkedIn and email on the right. Email is anika_giri@berkeley.edu, the address already public on her GitHub profile. The turntable pins below the header.
- There is no Side B. The crates are the back catalogue, so a flipped record holding the same jobs would repeat them.
- No empty half of the screen. Release notes are set small beside or under the record, like the back of a sleeve.

Type:

- Giant word and display: Climate Crisis (chosen over Unbounded Black and Dela Gothic One as closest to the reference).
- Small tracked caps: Montserrat semibold, wide letter spacing.
- Body and notes: Bricolage Grotesque.
- IBM Plex Mono only for the catalog number under the barcode and on the price tag. No monospace body text anywhere.

Still banned: purple-blue gradients, glassmorphism, floating blobs, generic rounded card grids, text over busy imagery, Inter, Roboto, Arial, system default fonts, Instrument Serif.

- Body text always sits on flat color and passes WCAG AA contrast.
- Motion is physical (weight, inertia, easing, no bounce). Respect prefers-reduced-motion.


## Workflow

- Before calling any UI task done, take Playwright screenshots at desktop and mobile widths, critique them against this file, and fix what's off.
- Run `npm run check:dashes` before finishing any task. It must pass.
- Commit at each meaningful boundary with a clear message.

## Commands

Node is pinned in `.nvmrc`. The system Node on this machine is older than Astro requires, so every npm command needs the nvm version on PATH first:

```
export PATH="$HOME/.nvm/versions/node/v22.23.5/bin:$PATH"
```

| Command | Does |
| --- | --- |
| `npm run dev` | Dev server on :4321. Astro daemonizes it, so the command returns immediately. |
| `npx astro dev stop` | Stops it. `astro dev status` and `astro dev logs` also work. |
| `npm run build` | Static output to `dist/`. |
| `npm run commits` | Regenerates `src/data/commits.json` from GitHub. Needs `gh` auth. |
| `npm run check:dashes` | Fails if any em or en dash is in `src` or `public`. |
| `npm run shots -- /path` | Playwright screenshots at 1440 and 390 wide into `.shots/`. Needs the dev server running. |

## Structure

- `src/data/catalogue.ts` holds all site copy. Edit words there, never in components.
- `src/data/commits.json` is committed on purpose, not generated during `npm run build`: deploys then need no network and no GitHub token, and builds stay reproducible.
- `scripts/fetch-commits.mjs` counts only commits authored by `anikag35`. A waveform including other people's work would be a lie. Do not change this.
- Tracks are `<details>`/`<summary>`, not a JavaScript accordion, so content is never behind an interaction and in-page find works.

## Open items

- Clips for tripwire, double-blind, cloudscape (Anika records these)
