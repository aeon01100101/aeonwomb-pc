# Aeon Womb PC — ChatGPT's Assignments

You are taking on five jobs carved out of Muse's lane for **Aeon Womb
PC**, a browser game (plain HTML/CSS/JS + Three.js r149, no build step)
set in 1960s Charles City, Iowa. A pregnant mom lives her day — house,
yard, a drivable 1956 Bel Air with real systems (fuel, 6V electrics,
wear, mail-order parts), needs (hunger/thirst/rest/comfort), errands,
and a town with named NPCs. Muse owns the game code and integrates
everything; your deliverables are **specs, data, one standalone
tool, and the downloaded car mods**. Isaiah carries files between us.

## Rules
- You never edit the game's live files and never write game systems.
  You deliver documents, data files, and the one tool below.
- Every deliverable goes to Isaiah first. He passes it to Muse, who
  implements/wires it in and proves it in the test bench.
- Player-facing text: plain words, big feelings, no jargon — a young
  kid should follow it. Period-correct: 1960s small-town Iowa, no
  modern tech or slang in anything the player reads.
- Numbers matter. Where a job asks for values, give concrete numbers
  with a one-line reason, not ranges like "somewhat faster."
- One job per file, named exactly as listed. Plain Markdown for docs,
  plain JavaScript for data (data only — no functions, no DOM).

## Job 1 — Winter layer spec → `WINTER_SPEC.md`
My Winter Car is the reference: winter is a *systems* season, not a
coat of paint. Spec, with implementable numbers:
- Weather states (clear / light snow / snowfall / blizzard): how each
  changes visibility, road grip (a grip multiplier per state), and
  snow build-up on the ground, roofs, and the car
- Cold vs the car: battery capacity at 20°F / 0°F / −20°F, why the
  choke matters more, cold oil and cranking, frost on the windshield
  and what clears it
- Cold vs her: how her four needs drain differently in winter, what
  "dressing warm" could mean as a simple game choice
- How winter arrives and leaves (a simple calendar rule)
Keep it to what Muse can build in a browser game; end with a short
"build order" list (what to implement first, second, third).

## Job 2 — Multiplayer protocol spec → `MULTIPLAYER_SPEC.md`
Design on paper only. The shape is already decided: **serverless
WebRTC** — one player's browser tab hosts the town zone, invites are
link/code exchanges carried over Discord, the host migrates if the
host leaves, and free public MQTT brokers are the fallback note-passers
for stubborn routers. Spec:
- The invite: what data rides inside the link/code, and the reply-code
  handshake, step by step
- The message list: every message type two tabs exchange (join, leave,
  her position/state, chat, host migration, …) with its fields
- Host migration: the exact steps when the host's tab closes
- The Player List: how a host announces "my town is open" on a free
  bulletin board, and what an entry shows

## Job 3 — Data tables → `weather_presets.js` and `npc_schedules.js`
- `weather_presets.js`: Charles City, Iowa weather by month — typical
  high/low (°F), precipitation chance, snow chance Oct–Apr — as one
  plain data object. This feeds the game's "the server is the sun"
  live-world design (world state from the real clock).
- `npc_schedules.js`: a simple daily schedule for each named NPC —
  Betty (bakery), Mr. Doyle (diner), Mrs. Henderson, Mr. Patterson
  (mailman), Mrs. Kowalski, Little Timmy + his dog Biscuit. For each:
  where they are at breakfast / midday / afternoon / evening, in plain
  data. Spots must be places that exist in town: the bakery, the
  diner's, the post office, the library, the park gazebo, Main Street,
  the church, home porches.

## Job 4 — Standalone tool → `make_packs_manifest.mjs`
A Node script Muse currently does by hand: scan a `packs/` folder
(car packs live at `packs/cars/<name>/model.glb`) and print a
`packs.json` manifest — for each pack: id, name, size in MB (one
decimal), and its file list. Runnable as
`node make_packs_manifest.mjs <packs-folder>`; output is JSON on
stdout; no dependencies beyond Node itself. Include a short comment
header saying what it does and an example run.

## Job 5 — Download the car mods → the files themselves + `MODS_GOT.md`
Muse's sandbox is walled off from the mod sites (Cloudflare), so
the downloading is yours. Rules: free, public mod downloads only,
from the mod's own public page; period-correct cars for 1960s Iowa
(nothing newer than 1967); BeamNG.drive mods preferred (they carry
DAE meshes Muse can convert).
- **First target:** 1966 Ford Fairlane 500, BeamNG.drive mod (the
  ModsHost listing points to a ~78 MB `Ford_Fairlane_500.zip`).
- **Then:** more period BeamNG classics — American cars and trucks a
  Charles City family might plausibly see in the mid-1960s — plus
  any My Winter Car mods worth having.
- Deliverable: the actual downloaded files, handed to Isaiah, plus
  `MODS_GOT.md`: for each file — mod name, car and year, source page,
  file size. If a download can't be fetched, say so in the list
  instead of substituting a different file.

## Not yours
Game systems, scene building (Grok's lane), standalone code tools
and in-game text drafts (Copilot's lane), integration, conversion,
testing, and publishing stay with their owners. If a job isn't
listed here, it isn't ChatGPT's until Isaiah says otherwise.
