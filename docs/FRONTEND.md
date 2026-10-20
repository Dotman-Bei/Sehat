# FRONTEND.md — Sehat

Source of truth for layout, visual style, type, colour, components, responsive behaviour and
interaction for the Sehat web app. The PRD (`Sehat_PRD.md`) defines what the product does; this file
defines how it looks and behaves. Design method: the `design-taste-frontend` skill (house rules,
direction sheet `.taste-skill/direction.json`, app sheet `.taste-skill/app/direction.json`).

Stack: Next.js 15 (App Router) + TypeScript + plain CSS (one global token file plus CSS modules).
No UI kit, no Tailwind, no chart library. Charts are drawn in SVG by our own helper, following
the skill's chart rules.

---

## 1. Who it is for, and the one action per page

Two audiences, both technical, both sceptical by trade:

- **Security researchers** (independent auditors and bug hunters). They need to know four things
  before spending a weekend on a target: what is in scope, what it pays, whether the money exists,
  and who will read the report. They read on a laptop, often at night, and check payouts on a phone.
- **Programme owners** (protocol teams on BOT Chain). They want a structured intake queue, a budget
  they control, and a payout record that proves they paid. They work in the dashboard for long
  triage sessions.
- Secondary: **triagers** (owner-authorised teammates) and **platform admins** (moderation only, no
  access to escrow).

| # | Route | Page | Kind | The one main action |
|---|---|---|---|---|
| 1 | `/` | Home | Page | Browse programmes (owners: Start a programme) |
| 2 | `/programs` | Programmes | App screen, list | Open a programme |
| 3 | `/programs/[programId]` | Programme detail | App screen, detail | Submit a report |
| 4 | `/programs/[programId]/submit` | Submit report | App screen, form | Submit privately |
| 5 | `/researcher` | Researcher dashboard | App screen, list | Answer the oldest information request |
| 6 | `/reports/[reportId]` | Report detail | App screen, detail and thread | Owner: release the agreed reward. Researcher: reply |
| 7 | `/programs/create` | Create programme | App screen, builder | Register, then fund escrow |
| 8 | `/dashboard/programs/[programId]` | Programme management | App screen, overview | Triage the oldest report |
| 9 | `/admin` | Platform admin | App screen, queue | Resolve the oldest abuse report |

---

## 2. Visual direction

### Thesis

**The board and the ledger.** Sehat is literally a bounty *board*: the home page is one continuous
board of tiles fitted edge to edge, and every tile is a real piece of the product (a programme's
escrow, a sealed report, a payout receipt). Behind the board sits a *ledger*: the app screens are
a quiet black terminal where numbers carry their sign, hashes and addresses stack in tabular
figures, and the only colour is a 1px crimson line on whatever is selected, plus crimson on the
single most important figure on each screen.

The idea, in one sentence: **on this page, the split between what the chain sees and what the
owner sees becomes the board's tiles.** Every report appears twice: sealed (digest, address,
amount) and open (title, impact, steps). A competitor's bounty board cannot say this sentence,
because Sehat's privacy split is its product.

**The one live thing** (home page, "What the chain sees"): a real sample report with a viewer
switch (Programme owner / Researcher / Public chain). The visitor confirms a severity, sets the
reward inside the tier's range and the programme's remaining escrow, and presses Release. The
receipt appears. Pressing Release again is refused with the contract's own reason: "Report
reference already paid." It works with a thumb, and without script the panel shows the owner's
view with a static receipt.

Direction: `dense-tiles` "The well-kept board" (seed 1170654131). App style: `data-terminal`
(seed 544294152), with palette and type kept from the page.

### Palette (exact values)

One ground, one ink, one accent. The accent is about 3% of any screen.

| Token | Value | Role |
|---|---|---|
| `--ground` | `#0a0a0a` | Page and app ground |
| `--surface` | `#151515` | Tiles, panels, cards (one step up) |
| `--raised` | `#1f1f1f` | Nested panel, hover row, input fill |
| `--active` | `#262626` | Selected row in a list that drives a detail pane |
| `--border` | `#262626` | 1px panel edge (app screens only) |
| `--rule` | `#1c1c1c` | Row rules in tables |
| `--control` | `#444444` | Input and outlined-button borders |
| `--ink` | `#efefef` | All running text, identities, key numbers |
| `--muted` | `#a3a3a3` | Secondary text (7.9:1 on `--surface`) |
| `--faint` | `#8c8c8c` | Meta, axis ticks, placeholders (5.6:1 on `--surface`) |
| `--accent` | `#b11226` | Crimson: the one primary action on the home page, the selection line, the screen's main data mark |
| `--accent-text` | `#ff5a6e` | Crimson when it must be read as text on black (5.9:1) |
| `--accent-ink` | `#ffffff` | Text on crimson fills |
| `--paper` | `#efefef` | Inverted field (FAQ bands, the CTA field) |
| `--paper-ink` | `#0a0a0a` | Text on paper |
| `--positive` | `#3fc07a` / pill `#172a1d` | Paid, funded, receipt confirmed |
| `--negative` | `#e5566f` / pill `#2c1a20` | Refused, failed, invalid, escrow exhausted |
| `--notice` | `#e0b04c` / pill `#2a2312` | Needs information, paused, closing |
| `--grid` | `#2b2b2b` | Chart gridlines |

Crimson is **not** used for "bad"; `--negative` is a separate, pinker red so a failed payout never
reads as the brand colour. Severity is never colour-coded as a rainbow: severity is a word,
ordered by position, with Critical alone allowed the accent.

### Typefaces (two)

- **Libre Franklin**, 400 / 500 / 600 / 700. Display (700, tracking -0.035em, leading 0.92) and
  the whole interface (14px body in app screens). Tabular figures on every number, hash and address.
- **Source Serif 4**, 400 / 600 / italic. One job: long-form reading. Home-page body copy,
  programme rules and scope prose, report bodies and triage messages.

No monospace anywhere. Hashes and addresses are set in Libre Franklin with `tabular-nums`,
truncated to `0x7a3f…c91e`, with a copy control.

Type steps, page (five sizes):

| Step | Value | Use |
|---|---|---|
| small | `clamp(13px, 0.79rem + 0.1vw, 14px)` | Strips, captions, footer |
| body | `clamp(17px, 1rem + 0.25vw, 19px)` | Serif running text |
| lead | `clamp(20px, 1.1rem + 0.7vw, 26px)` | Tile statements, card clauses |
| head | `clamp(32px, 1.3rem + 3.2vw, 64px)` | Section headings, h1 in the hero panel |
| figure | `clamp(88px, 10vw, 168px)` | The one headline figure (stats) and the footer block mark |

Type steps, app screens: 12 / 14 / 16 / 24 (title) / 32 (the one answer figure per screen).

### Spacing scale

4px base: `4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192`.

- Page: board gap 8px; outer margin 12px (phone 8px); tile padding 24px (phone 20px); sections
  128–192px apart where the board breaks into bands.
- App: one gutter of 16px everywhere (horizontal and vertical), card padding 20px, canvas side
  padding 32px (phone 16px), title 32px from the canvas top, sections 48px apart.

### Radius, edges and depth

- **Square corners everywhere** on the page (radius 0), including buttons.
- App screens: panels 6px, controls 6px, chips 4px. Three radii, no more.
- No shadows at rest, no glows, no glass, no gradients. Surfaces separate by a tone step; app
  panels may add a 1px `--border`. Menus, dialogs and toasts are the only things with a shadow.

### Motion rules

- Page signature move: **the shutter**, once, on the hero's centre fragment (clip-path opens from
  the bottom over 1.1s while the fragment settles from 1.12 scale).
- Page entrances: each section's heading, then its text, then its picture, staggered 70ms, rising
  24px with opacity, once, as the section enters. Content is visible if the script fails.
- Feedback on every control: 150ms press (scale 0.98), hover tone step, visible 2px crimson focus ring
  offset 2px.
- The how-it-works cards rise 6px on hover; the hero sheet's columns drift 0–40px with scroll
  (one moving picture), along with one muted loop of the vault mechanism if a clip exists.
- App screens: no entrances. Motion is feedback only: hover, press, a dialog or sheet opening, a
  row arriving after a status change, the transaction state progressing.
- Transform and opacity only. `prefers-reduced-motion` keeps all content and removes travel.

---

## 3. Shared components

| Component | Desktop | Phone (≤ 640px) |
|---|---|---|
| **Site bar** (home) | No bar over the hero. The hero panel carries the wordmark and links. On scroll, a plain 56px black bar appears: wordmark, Programmes, Researchers, Owners, one "Browse programmes" button. | Same bar; links fold into a Menu button that opens a full-screen sheet. |
| **App rail** (routes 2–9) | 56px icon rail on the ground with a 1px edge: Sehat mark on top; Programmes, Researcher, My programmes, Admin (admin only); utilities at the bottom: network, wallet. Tooltips and accessible names on every icon. Active item: a 1px crimson bar on the rail's right edge, the icon turns `--ink`. | Bottom bar of four icons with short labels; wallet and network move into the top bar. |
| **Top bar** (app) | 48px: breadcrumb (the scope, e.g. "Programmes / Quayside Bridge"), then on the right the network chip ("Bohr testnet · 968") and the wallet button. | 48px: screen name, network dot, wallet button. |
| **Wallet button** | Disconnected: outlined "Connect wallet". Connected: `0x4b1e…a07d` with a 16px initials disc. Wrong chain: notice pill "Switch to BOT Chain", which calls `wallet_switchEthereumChain`. | Same, icon-only when narrow. |
| **Preview notice** | One quiet line under the top bar while data is sample data: "Preview data. Programmes, reports and balances on this build are samples, not contract state." Notice colours, 12px. | Same, one line, truncates. |
| **Button** | Page: square, 48px, crimson fill, white label. App: one primary per screen, inverted (`--ink` fill, black label, 36px, radius 6); secondary outlined `--control`; tertiary text. | 44px min height, primary full-width in forms. |
| **Status pill** | Pale-on-dark pair, 20px tall, 12px/500, never squeezed (`flex: none`). One per row. States: Submitted, Triage, Needs information, Duplicate, Out of scope, Invalid, Accepted, Reward agreed, Paid, Closed without reward. Programme states: Draft, Active, Paused, Closing, Closed, Escrow empty. | Same. |
| **Severity mark** | Word only, ordered Critical → Informational. Suggested severity in `--muted`; confirmed severity in `--ink` with "confirmed" sublabel. Critical may carry the accent. | Same. |
| **Escrow track** (signature) | One horizontal track as long as the total funded: paid (ink), agreed but unpaid (`--muted` hatch), available (crimson). Both ends labelled, values in BOT. | Full width, legend below in a 2-column grid. |
| **Hash / address** | `0x7a3f…c91e` in tabular figures, copy icon 12px after; links to `scan.bohr.life` (testnet) or `scan.botchain.ai` (mainnet) from config. | Same. |
| **Transaction state** | Inline, in the block that started it: Waiting for wallet → Submitted (hash) → Confirmed (block) / Failed (reason, Retry). Success shows only after the receipt. | Same, full width. |
| **Table** | 12px grey sentence-case headers, no fill, 48px rows, `--rule` row lines, numbers right-aligned, one status mark per row, one trailing action. | Two-line rows: identity and key number on line 1, the rest in 13px grey on line 2. |
| **Tabs** | Underline tabs on a full-width 1px rule; the selected tab gets a 1px crimson line as wide as its label (the style's move). | Scroll sideways in their own row. |
| **Dialog** | Confirms irreversible actions (release payout, close programme). Names the object, the recipient and the amount in full. | Full-screen sheet. |
| **Empty / loading / error** | Empty keeps the frame and says one sentence with the next step. Loading: grey bars at real size, no shimmer. Error: inside the block, one sentence plus Retry. | Same. |

---

## 4. Pages, in build order, with copy

All programme, report and payout data below is **sample data** for the build, written to
`web/lib/sample-data.ts` and computed from rows (totals are sums). It must be replaced by
contract reads and the API before launch. Protocol names are invented.

Sample programmes (escrow in BOT):

| ID | Project | Programme | Status | Escrow | Critical range |
|---|---|---|---|---|---|
| `quayside-bridge` | Quayside | Bridge relayer and proof verifier | Active | 75,000 | 30,000–60,000 |
| `brindle-amm` | Brindle | AMM v2 core contracts | Active | 48,000 | 20,000–40,000 |
| `larkspur-lending` | Larkspur | Lending markets and liquidator | Active | 32,500 | 15,000–30,000 |
| `kestrel-oracle` | Kestrel | Price oracle and keeper network | Active | 18,000 | 10,000–15,000 |
| `fennel-wallet` | Fennel | Browser wallet signing flow | Paused | 6,200 | 4,000–6,000 |
| `marrow-staking` | Marrow | Liquid staking vault | Closing | 3,400 | 3,000–8,000 |
| `saltmarsh-dao` | Saltmarsh | Governance timelock | Active, escrow empty | 0 | 5,000–10,000 |
| `oriel-names` | Oriel | Name registry | Closed | 0 | — |

### 4.1 Home — `/` (page)

Composition: one board of tiles (12 columns, 8px gaps, 12px margins), then bands.

**Hero: "Sheet with a text cell".** Six columns of interface fragments at natural ratios, each with
a 28px coloured strip (13px label) fused to its bottom edge, columns offset vertically (0, -90, -40,
-130, -20, -70px) and cropped by the viewport. Fragments: Quayside's escrow tile, a sealed report
card, a payout receipt, Brindle's reward tiers, Larkspur's scope list, a triage thread excerpt,
Kestrel's funding event, a vault photograph. In columns 3–4 at 28% height, the text panel (paper,
410px):

- Wordmark: **SEHAT**
- h1: **Bug bounties held in escrow**
- Sentence: *Teams lock rewards in native BOT before research starts. Researchers report privately
  and are paid on-chain when a finding is accepted.*
- Button: **Browse programmes**
- Links at the panel foot: Start a programme · How payouts work · Trust model

Strip labels: "Quayside · 75,000 BOT in escrow", "Report SHT-0157 · sealed", "Paid · 450 BOT ·
block 1,284,551", "Brindle · reward tiers", "Larkspur · in scope", "Triage · needs information",
"Kestrel · funded 18,000 BOT", "Escrow".

Phone: the panel leads at full width (40% of screen), sheet resumes in two offset columns.

**Showcase: "What the chain sees"** (the live thing). Heading **What the chain sees**. Sentence:
*Switch viewers on a real report. The public ledger gets a digest, an address and an amount, and
nothing else.* Panel split 62/38. Left: report SHT-0163 "Liquidation bonus computed before the
oracle staleness check" on Larkspur, rendered per viewer. Right, control rows:

1. Viewer: Programme owner / Researcher / Public chain
2. Suggested severity: High (researcher's, read-only)
3. Confirmed severity: High / Medium / Low
4. Agreed reward: slider within the confirmed tier's range (High: 5,000–12,000 BOT)
5. Escrow available: 32,500 BOT (updates after release)
6. Status: Reward agreed → Paid
7. Release reward (button)

After release: "Paid · 9,500 BOT · tx 0x51c2…e08a". Pressing again: "Refused: report reference
already paid." Line under the panel: *Pick a viewer to start.* Link in the panel corner:
**Read the trust model**.

Owner view shows: title, affected target `LiquidationEngine.sol`, impact, three reproduction
steps, triage note. Researcher view: the same minus the private triage note ("Programme notes are
hidden unless the team shares them"). Public chain view: programme ID, report digest
`0x9e4d…7b20`, recipient `0x4b1e…a07d`, amount, tx hash; every other field reads "Not on-chain".

**How it works: "From report to payout"** (four fields, one report card further along each time):

1. *First it lands, sealed.* Card: SHT-0163, Submitted, suggested High, digest only.
2. *Then the team triages it.* Card: Triage, triager `KO`, confirmed High, one question asked.
3. *Then both agree the reward.* Card: Reward agreed, 9,500 BOT, recipient shown to the
   researcher before settlement.
4. *Then the contract pays it.* Card: Paid, tx hash, block, explorer link.

**Stats: "In escrow right now"**: bars standing on the bottom edge, one per sample programme with
a non-zero balance, sorted; the headline figure is the computed total **183,100 BOT**, claim
*in escrow across 6 programmes*. Quayside's bar takes the accent (the largest pool). Three bars print
their values. Note: *Preview figures from sample programmes. Live figures are read from the escrow
contract.* Hover or focus a bar: name and balance.

**Features: "Rules you can check"** (eight close-up tiles, mosaic). Each tile holds one real
interface element enlarged, cropped by two edges, with a name and one line:

- **Balance from contract state.** The figure you see is read from the escrow contract, not typed in.
- **One payout per report.** A paid report reference is refused a second time.
- **Never more than escrow.** A release above the remaining balance fails in the contract.
- **Reports stay off-chain.** Only a digest, an address and an amount reach a public event.
- **Severity you confirm.** The researcher suggests; the owner confirms. Both are shown.
- **Pause without losing reports.** Pausing stops new reports; nothing submitted is erased.
- **Every payout on the explorer.** Each paid report links to its transaction on BOT Chain.
- **Triagers you authorise.** Teammates can triage; only the owner wallet releases funds.

**FAQ: "The trust model"** (bands, all answers visible):

- **Does Sehat decide whether a report is valid?** No. The programme owner and their triagers
  review each report and decide. Sehat records the decision and, if a reward is agreed, the
  contract pays it from escrow.
- **Is a reward guaranteed?** No. The contract guarantees the money is in escrow, that a report is
  never paid twice, and that no payout exceeds the balance. It cannot force an owner to accept a
  report. Rewards are not guaranteed income.
- **What goes on-chain?** The programme reference, funding and payout amounts, wallet addresses,
  a report digest and the transaction. Report text, reproduction steps and attachments never do.
- **Who can read my report?** The programme owner, the triagers they authorise, and platform
  operators under documented access rules. Reports are stored privately with an access check on
  every read. They are not end-to-end encrypted.
- **What happens when a programme closes?** Open reports keep a payout window. Unused escrow can
  return to the owner only after the close conditions in the contract are met; until safe closure
  ships, withdrawal stays disabled.
- **Can Sehat staff move escrow?** No. Admins can hide a programme from the directory for abuse.
  They cannot withdraw escrow or redirect a payout.
- **Which network and token?** BOT Chain mainnet (chain 677) and Bohr testnet (chain 968), paid in
  native BOT. Sehat has no token of its own.

**CTA: "Put your bounty in escrow"**. Two lines: *Draft the scope and reward tiers, fund them in
native BOT, and publish when the receipt confirms. Researchers see the balance the moment it
lands.* Button: **Start a programme**. Flanks: the vault photograph; a flat crimson field.

**Footer**: SEHAT built from blocks across the full width. Link columns:
Programmes (Browse programmes, Start a programme, Researcher dashboard) · Rules (Trust model,
Disclosure rules, Severity guide) · Network (BOT Chain mainnet 677, Bohr testnet 968,
scan.botchain.ai) · Project (BOT Labs incubation, Build updates, Report abuse). Contact lines:
*Report a platform problem through Report abuse. Never send a vulnerability by email; submit it to
the programme.* Last row: © 2026 Sehat, picture credits, small button **Browse programmes**.

### 4.2 Programmes — `/programs` (list)

Question: *Which funded programme is worth my time?*

- h1 **Programmes**. Subline: *4 of 8 accept reward-bearing reports, with 183,100 BOT in escrow.
  Kestrel opened 3 days ago.* (computed from the rows)
- Tabs: Active (5) · Paused (1) · Closing (1) · Closed (1) · All (8). (Saltmarsh counts as Active
  with escrow empty.)
- Toolbar: search "Search by project or target", sort "Most in escrow" / "Newest" / "Highest
  critical"; count "5 programmes".
- Table columns: Programme (project name over programme title) · Scope (first two targets, "+3")
  · Critical up to · In escrow (BOT) · Updated · status pill. Row click opens the programme.
  Escrow-empty row: pill "Escrow empty", subline "Not accepting reward-bearing reports".
- Right of the title: primary **Start a programme**.
- Empty search: *No programme matches "xyz". Search covers project names and in-scope targets.*

### 4.3 Programme detail — `/programs/[programId]`

Question: *What can I test, what does it pay, and is the money there?*

- Breadcrumb Programmes / Quayside. h1 **Quayside Bridge relayer and proof verifier**. Subline:
  *Active since 2026-08-04. Owner 0x91c0…44be.* Primary **Submit a report** (disabled with a
  reason when paused, closing, closed or escrow empty).
- Lead block: escrow track (75,000 BOT available of 100,000 funded; 25,000 paid; agreed but unpaid
  shown), the figure at 32px, "Read from contract 0x3d1f…a92c at block 1,284,601 · 2 min ago",
  explorer link.
- Reward tiers table: Severity · Range (BOT) · Example impact.
- Scope: In scope (target, type, note) and Out of scope, two columns.
- Rules of engagement (serif prose), Disclosure (timeline 90 days), Duplicates and disputes.
- Right rail (384px): Funding and payout history (events with tx links), Programme facts (start,
  end, closing window 30 days, reports received, paid count).
- Phone: rail moves under the main column; Submit becomes a sticky bottom button.

### 4.4 Submit report — `/programs/[programId]/submit` (form)

Question: *Have I given the team enough to validate this safely?*

- h1 **Report to Quayside**. Subline: *Private to the Quayside team and the triagers they
  authorise. Nothing you write here is put on-chain.*
- Fields: Title · Vulnerability category (select) · Suggested severity (radio, with the tier range
  beside each) · Affected target (select from scope; "Not listed" warns it may be out of scope) ·
  Impact · Reproduction steps · Evidence attachments (PDF, PNG, TXT; 10 MB each, 5 files; never
  executed) · Payout wallet (prefilled from connected wallet) · Rules confirmation checkbox: *I
  followed this programme's rules of engagement and have the right to submit this report.*
- Right column: "What the team sees / what the chain sees" summary, the programme's rules
  checklist (no DoS, no data exfiltration, no social engineering, report accidental data access).
- Submit: **Submit privately**. Success state in place: *Report SHT-0179 received.* Reference,
  private link note, next step: *The team usually replies here, on your dashboard.* No response-time
  promise.
- Validation inline under each field; the button names what is missing.

### 4.5 Researcher dashboard — `/researcher` (list)

Question: *Which of my reports need me, and what have I been paid?*

- h1 **Your reports**. Subline (the finding): *1 report needs information from you. 30,000 BOT
  agreed and awaiting release.*
- Lead row, two blocks of one height: **Waiting on your reply** (the team's question quoted, with
  **Reply to …**) and **Rewards** (30,000 BOT awaiting release as the answer figure, each agreed
  or paid reward, "Paid to you so far 450 BOT"). No separate KPI strip: the status counts live in
  the tabs (All 7 · Open 3 · Accepted 2 · Closed without reward 2), computed from the rows.
- Table: Reference · Title · Programme · Suggested / confirmed severity · Status · Reward (BOT) ·
  Updated. Filters: status tabs, programme select, date sort.
- Paid rows show the tx link. Closed rows show the reason ("Duplicate of an earlier report").
- Disconnected: frame kept, *Connect a wallet to see the reports you submitted from it.*
- Preview builds accept `?as=researcher`, `?as=owner` or `?as=admin` to select a labelled preview
  identity, so every role's screen can be reviewed without a deployed contract.

### 4.6 Report detail — `/reports/[reportId]` (detail and thread)

Question: *Where is this report, and what is the next step?*

- h1 is the report title; subline: reference, programme, submitted date.
- Status track: Submitted → Triage → Accepted → Reward agreed → Paid, current step marked by the
  crimson line; off-path outcomes (Duplicate, Invalid, Out of scope, Needs information) shown as the
  current pill with reason.
- Main column: report body (serif), attachments (name, size, "Download" behind auth), thread
  (researcher and team messages; private triage notes marked *Team only* and visible to the team
  only).
- Right rail: Severity (suggested vs confirmed), Agreed reward, Recipient, Escrow available, and the
  owner's **Release 30,000 BOT** with a confirm dialog that names recipient, amount, report
  reference and programme. Transaction state inline. Paid: tx link, block, time.
- Unauthorised: *This report is private to its researcher and the Quayside team.* No content leaks.

### 4.7 Create programme — `/programs/create` (builder)

Question: *Is my programme ready to publish, and is it funded?*

- h1 **New programme**. A left step list (Basics, Scope, Rules, Rewards, Dates, Review, Register,
  Fund, Publish), each with a done state; the step list is position-ordered, not numbered.
- One panel per step, settings layout (label column with help, panel with fields). Rewards: a
  row per severity with min and max BOT. Dates: start, optional end, closing window.
- Review: the programme as researchers will see it, beside a checklist.
- Register: transaction state. Fund: amount in BOT, shows the wallet balance, the escrow track
  previewing the result. Publish is disabled until the funding receipt confirms: *Funding not
  confirmed yet. Publish unlocks when the receipt lands.*

### 4.8 Programme management — `/dashboard/programs/[programId]` (overview)

Question: *What needs triage, and can escrow cover what we have agreed?*

- h1 **Quayside Bridge**. Finding line: *3 reports wait for triage; the oldest is 4 days old.
  30,000 BOT agreed, 45,000 BOT left after it is paid.*
- Escrow track (signature), with **Add funds** and funding history.
- Triage queue (capped at 5, "View all 9"): reference, title, suggested severity, age, status, one
  action ("Triage").
- Awaiting release: agreed rewards with **Release**.
- Status: Active / Paused / Closing control, closure panel showing eligible unused balance
  ("Withdrawal disabled until the closing window ends on 2026-12-01").
- Triagers: list with initials discs, Add triager.

### 4.9 Platform admin — `/admin` (queue)

Question: *Which abuse reports need a decision?*

- h1 **Moderation**. Subline: *2 open abuse reports. Admins can hide programmes; they cannot touch
  escrow.*
- Queue: abuse reports (target, reason, reporter, age, **Review**). Decision dialog: Hide from
  directory / Dismiss, reason required.
- Platform metrics (one divided strip): programmes published, funded, unique owners, unique
  researchers, reports submitted, accepted, paid, BOT escrowed, BOT paid. All computed.
- Audit log table: time, actor, action, target, reason.
- Not an admin: *This area is for platform administrators.*

---

## 5. Avoid

Generic patterns the skill bans, and the Sehat-specific temptations behind them:

- Shield icons, padlocks in circles, hooded hackers, green-on-black matrix code, "cyber" neon.
- A centred hero headline over three icon feature cards; any row of identical icon-topped cards.
- Eyebrow labels and pill badges above headings ("NEW", "SECURITY"), tiny uppercase tracked labels.
- Monospace for "hacker" flavour. Hashes are tabular Libre Franklin.
- 01 / 02 / 03 step numbers, "Step 2" labels.
- Gradients, glows, glass panels, shadows on resting cards, floating pill navigation.
- Violet or indigo; cream with terracotta.
- Hairline grids, crosshairs, crop marks, thin dividers on the page (app screens may use 1px rules).
- Invented traction: "10,000+ researchers", "$50M protected", fake logos, fake quotes. Every figure
  is computed from data and labelled as preview data until it is real.
- "Guaranteed payout", "fully secure", "audited" claims the contract cannot enforce.
- KPI tiles with icons in tinted circles, sparklines, a rainbow of severity colours, a dark navy
  sidebar, a "Welcome back" greeting.
- Stock copy: unlock, empower, seamless, robust, cutting-edge, next-generation.

---

## 6. Build notes (decisions taken while building)

- **Hero strips.** The frames directly above the text panel and at the foot of the centre column
  carry no colour strip. A short label directly above a heading reads as an eyebrow.
- **Home bar on phones.** The scrolled site bar keeps the wordmark and **Browse programmes** only;
  the three text links live in the hero panel and the footer.
- **Stats.** The bars are the platform's escrow at the end of each of the last 14 weeks, computed
  from the escrow events, with the current week in crimson. On phones they become the last 8 weeks
  as horizontal rows.
- **Privacy on public pages.** Programme detail shows only on-chain facts (funded, paid, returned,
  available). Agreed-but-unpaid rewards appear only to the owner, since they would reveal an
  unfixed finding.
- **App type.** Libre Franklin for the interface, Source Serif 4 for report bodies, rules and
  messages. Hashes and addresses are tabular Libre Franklin; no monospace anywhere.
- **Metrics on admin** are split by source, *From the escrow contract* and *From the reports
  database*, because the two count different things (payouts include reports not in the database
  sample).
- **Preview identities.** While `NEXT_PUBLIC_SEHAT_ESCROW` is unset the app shows sample data,
  a notice line on every app screen, and preview identities in the wallet menu (or `?as=…`).
  Setting the escrow address turns all of this off.
