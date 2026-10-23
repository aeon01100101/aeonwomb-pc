# Aeon Womb PC — who builds what

Two builders, separate lanes, so nothing collides (Isaiah's call, Oct 23 2026).

## Muse's lane (systems + integration)
- Game systems: her needs, car parts + mail-order, winter layer
- Zones, driving, multiplayer (WebRTC tab-hosted), the Blink updates
- Packaging, publishing, the road to 5 GB
- Integrating and bench-verifying EVERYTHING, whoever wrote it —
  nothing ships on receipts alone

## Kimi's lane (standalone Three.js content)
- Pure scene-builder code only (`function buildX() { ... return group; }`,
  global THREE r149, no DOM, no localStorage, no systems)
- Job 1: the Lobby waiting room
- Job 2: town dressing props (mailbox, hydrant, bench, lamp, phone booth…)
- Job 3: furniture sets (kitchen, nursery)

## The handoff rule
Kimi delivers code; she never edits the live game files. Muse reviews
her builders, wires them into the game, and proves them in the test
bench before they ship. If a task isn't on either list, it's Muse's
until Isaiah says otherwise.
