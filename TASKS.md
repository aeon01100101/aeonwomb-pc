# Aeon Womb PC — who builds what

Two builders, separate lanes, so nothing collides (Isaiah's call, Oct 23 2026).

## Muse's lane (systems + integration)
- Game systems: her needs, car parts + mail-order, winter layer
- Zones, driving, multiplayer (WebRTC tab-hosted), the Blink updates
- Packaging, publishing, the road to 5 GB
- Integrating and bench-verifying EVERYTHING, whoever wrote it —
  nothing ships on receipts alone

## Grok's lane (standalone Three.js content — "Kimi's lane")
- Pure scene-builder code only (`function buildX() { ... return group; }`,
  global THREE r149, no DOM, no localStorage, no systems)
- Job 1: the Lobby waiting room
- Job 2: town dressing props (mailbox, hydrant, bench, lamp, phone booth…)
- Job 3: furniture sets (kitchen, nursery)
- (This lane's history, all on Oct 23: Kimi AI was offered it first —
  unreliable. Claude AI next — also unreliable, and tried to take
  Muse's systems lane besides; Isaiah said no. Manus AI held it
  briefly. Grok holds it now. Lanes hold.)

## ChatGPT's assignments (carved from Muse's lane)
- Specs, data tables, one standalone tool — and downloading the car
  mods. See CHATGPT_TASKS.md in this folder. ChatGPT never writes
  game systems or edits live files; Muse implements from the
  specs, converts the mods, wires in the data, and bench-verifies
  everything.

## Copilot's lane (code + words)
- Writes standalone code: tools, scripts, and helpers that run
  OUTSIDE the game (converter glue, data cleaners, checker
  utilities). Muse reviews and verifies any of it before it runs
  on the project.
- Words: NPC dialogue lines, shop signage, mom's message lines,
  documentation drafts
- No game systems (that's Muse's), no Three.js scene builders
  (that's Grok's), never edits the live game files

## The handoff rule
The content builder gives files to Isaiah first — always. Isaiah
passes them to Muse himself; nothing comes to Muse straight from
another AI. Content builders never edit the live game files. Muse
reviews their builders, wires them into the game, and proves them
in the test bench before they ship. If a task isn't on either list,
it's Muse's until Isaiah says otherwise.
