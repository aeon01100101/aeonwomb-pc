# Aeon Womb — for PC (v0.9.0)

The Android womb explorer, rebuilt for PC in **real 3D** (WebGL via
Three.js r149, vendored — no downloads, no build step, no internet
needed). Same simulation as the Android game: same levels, same swim
physics, same living mother, same swish, same fetus rules. The
difference is the view: lit, textured, fog-deep 3D you can actually
see, plus keyboard + mouse controls.

## Run it

- **Linux:** `./start.sh` — serves the folder and opens your browser
  at http://localhost:8907
- **Windows:** double-click `start.bat` (needs Python), or just open
  `index.html` in a browser.
- Any modern browser works (Chrome/Edge/Firefox). Sound starts when
  you press **Enter the Womb** (browser autoplay rules).

## How to play

- **Mouse** looks (click the womb to grab the mouse; Esc releases).
- **W A S D** / arrow keys swim. You swim where you look — look up to
  rise, down to sink. Strokes surge like a real breaststroke; let go
  and you glide, drifting back to mid-water.
- Find the **golden sound bubbles** (gold dots on the minimap, top
  right). Each one is a sound from the world outside and fills your
  **Album** (saved in the browser).
- When every bubble is found, a **golden heart** glows by the baby —
  reach the baby to finish. With twins/triplets/octuplets the heart
  hops from baby to baby: visit them all.
- Mother is alive out there: she **walks** (the womb sways), **rolls
  over** (the world tilts), and from *Growing* on, **contracts**
  (the walls squeeze, her heartbeat quickens). Every so often the
  fluid **swishes** and carries you — and the bubbles.
- **H** or ❤ Feel: feel the heartbeat up close.
- **Tab** opens the **Quick Menu** (VRChat-style): a big friendly
  panel floating in front of you — Resume, Respawn, Restart, era
  tiles, audio switches and a volume slider, game settings, a live
  clock and fps meter, and a "You are here" card that tells you
  what mom is up to. The world politely pauses while it's open.
  **G** also cycles the graphics era from anywhere.
- **Fetus mode**: you ARE the baby — your own cord runs to your
  placenta, your tummy fills the bottom of the screen, and the big
  gold **KICK** button (or **K** / **Space**) lets mom feel you.
  Hear every sound *and* kick 5 times to win the day.
- 🗣 **Mom's voice** uses your computer's text-to-speech (quality
  depends on the voices installed; hers is picked automatically).
- 🏠 **Mom mode — her home, in real 3D** (new in v0.2): pick
  **Mom** on the start screen and step into her 1960s living room.
  She's there in 3D — red dress, beehive, hand resting on the bump —
  in a room you decorate yourself: **Suburban House** (sun, lawn,
  picket fence, a neighbour's house and a tree outside the window)
  or **City Apartment** (a dusk skyline of lit windows and a water
  tower). 41 home choices — wallpaper, floor, sofa, curtains, rug,
  console/portable TV or radio, wall decor, lamp, plant — from the
  🎨 Decorate panel, plus a 🎲 Shuffle button. Drag to look around.
  Her heartbeat is still under everything.
- 🚗 **Mom mode — Charles City, Iowa + the 1953 Bel Air** (new in
  v0.5.0): walk out her front door (it swings open for her) into a
  whole town — Main Street shops, the Charles Theatre, the
  courthouse (its clock keeps your real time), the Cedar River, a
  railroad, townsfolk going about their day, and traffic that
  eases ahead when you come up behind it. Her **'53 Bel Air** sits
  on the driveway, fully simulated:
  - **E** get in/out · **Enter** crank her over · **G** P R N D
  - **W/S** throttle/brake (or **V** for mouse throttle — the
    mouse *is* the gas pedal) · **A/D** steer · **T** trip reset
  - **C** choke — a cold lean engine *will* crank and die without
    it · **[ ]** carburetor screw (Park only; it drifts as she
    vibrates, and a mistuned carb makes the Powerglide bang its
    shifts)
  - **L** headlights (they cost the 6-volt battery 9 amps) ·
    **Z/X** turn signals · **U** vacuum wipers · **H** horn ·
    **I** condition card (engine, gearbox, brakes, tires,
    battery, plugs, oil — everything wears)
  - At the Main Street pumps, engine off: **F** fuel · **O** oil
    change · **Y** tune-up · **J** charge the battery. Watch the
    dash: speed, rpm, fuel, live MPG, amps and volts all work.

## Graphics modes (pick on the start screen, or press **G** / the
## top-bar button in game — they switch live)

- **😖 Ouch — Budget Mode**: for heroic little laptops. Softer
  resolution, fewer motes, no sparkles — same game, gentler load.
- **👑 I Could Run KH3 On This**: the full flex. Full resolution,
  anisotropic textures, sparkles, the works.
- **🕹 Early 2K Mode**: PS2 soul. Rendered at 480p and upscaled,
  smooth textures, chunkier shapes, closer fog.
- **📺 Early 90s Mode (aka PS1 graphics)**: 240p upscaled with
  crunchy nearest-neighbour pixels, flat facets, low-poly shapes,
  and the classic vertex wobble — corners snap to a grid, just like
  1995.

## What's new in v0.9.0

**The Lobby is the front door now.** The title screen no longer
floats over the womb — it stands in a 3D waiting room (content
lane build, integrated here): checkerboard floor, reception
desk, armchairs, a plant by the window, and a wall clock that
keeps your real time. The camera breathes a slow look around
the room while you choose; one ceiling panel flickers now and
then. This room is where multiplayer will live — the Player
List and hosting arrive here next — and where the game's
updates will ask "Stay idle or go to lobby?" when the Blink
comes. Quitting to the title brings you back to the Lobby.

## What's new in v0.8.0

**The content lane arrives.** The town and her home are dressed
with the first outside-built pieces, integrated and verified:
her mailbox is a proper blue rural box whose red flag is wired
to the parts mail (parcel in, flag up); Main Street gains a
fire hydrant, benches, five street lamps and a phone booth; her
house gains a real kitchen along the south wall and the baby's
nursery corner — crib, dresser and rocking chair. Everything
animates: flags sway, lamps flicker, the nursery mobile turns.
(Built by the content lane; integrated + bench-verified by
Muse: smoke test 6/6, content facts 12 live pieces, zero page
errors.)

## What's new in v0.7.0

**Real car parts — the My Summer Car layer, part 2.** The
station services a car; it can't un-wear it. Seven components
now wear for real — battery, plugs, brake shoes, whitewalls,
generator, engine, Powerglide — and the fixes are physical:
order at the Post Office (the card shows every part's honest
wear), the parcel comes to her home mailbox (watch the red
flag), and a part is fitted at the car with the wrench key R,
hood up, a couple of minutes under the bonnet. The condition
card (I) tracks it all, shelf included.

## What's new in v0.6.0

**Zones.** Her house, front yard and backyard are one home zone;
Charles City is another. Only the zone she stands in is loaded —
step off the lot and the Blink (a beat of black) loads the town
in around her, car and all. Same world, honest loading.

**Her needs — the My Summer Car layer, part 1.** A needs card
(Hunger / Thirst / Rest / Comfort + fridge meals) drains over
the day. The Grocer's stocks her fridge, Doyle's Diner cooks,
Betty's rolls are comfort on a plate, and home has the fridge
and a sofa nap — all on the E key, with a prompt that says what
E does right where she's standing. Run her low and she slows
down — and the baby feels it: her heartbeat in the womb runs
faster until she's looked after.

**The fleet grows.** The '56 Bel Air is now her real car when
its pack is installed (the BeamNG mod's own model, bone-stock —
doors, hood and steering all work), and a Satsuma E10 — the My
Summer Car Datsun, same treatment — parks at the gas station.
Cars are launcher packs: install what you want, load only what
you play.

## What's new in v0.5.0

The town update: Charles City, Iowa around her house (working
doors, Main Street, theatre, courthouse clock, river, railroad,
named townsfolk, traffic), a 1953 Bel Air with a real powertrain
(self-shifting Powerglide, live MPG, fuel burn), carburetor +
choke with drift and cold-start deaths, variable mouse throttle,
hard shifts, a 6-volt electrical system, wear and tear on every
system, gas-station services, an animation on every car feature,
and the FusionFall visual pass (warm sun, soft shadows, gradient
sky, painted textures). Full notes in `build-results.txt`.

## What's new in v0.4.2
- **Her chest, modeled and rigged** — the omission Isaiah caught. Two new
  bones (rig now 182) that breathe with her.
- **Her bump grows with the weeks.** Decorate panel → *Her week* stepper
  (8–40): the belly scales (×0.72 → ×1.16, plus a little per extra baby),
  her hands ride out to stay on it, and the panel tells you the baby's
  fruit-size, just like the Android build.

## What's new in v0.4.1
- **Her hands are on the bump.** Both hands cradle it — and in first person,
  looking down, you can see them there. When the baby kicks, her hands ride
  the bump.
- **The Starburst Mirror works.** Pick it under Decorate and it's a real
  mirror — walk her up to it in first person and she can see her own face.

## What's new in v0.4.0

- **Mama mode is FPOV now — you ARE mom.** Mom mode opens
  through her own eyes: click the room and mouse-look (or just
  drag), and **WASD / arrows walk her around her home** — she
  turns where you look, her steps bob gently, the sofa and TV
  are solid, and looking down shows what she sees: her dress,
  her apron, her hands' side of the bump (which still kicks —
  now from the inside view). Her head and neck hide themselves
  in first person, the way every FPOV game handles it. The
  **🎥 Third person** button in her top bar returns to the
  outside view any time; the game remembers your choice.
- **Gesture support, Kinect-style.** Under the hood the game
  now reads a single **Input layer** (move / strafe / turn
  intent) instead of raw keys — keyboard and mouse are just
  its first source. Its second source is built in: the
  **🤚 Gestures** button turns on your webcam and reads body
  motion the way a Kinect does, as zones of movement —
  **lean left/right to turn, step in place (low motion) to
  walk, raise both hands to pat the bump** (she answers out
  loud). A small mirrored preview in the corner shows what
  the camera sees. No camera, no problem: it says so kindly
  and the keyboard never stopped working. Any future sensor
  (gamepad, depth camera) plugs into the same Input layer.
  *Note: the camera needs the game served from localhost —
  start.sh / start.bat already do exactly that.*

## What's new in v0.3.2

- **A real skeleton: exactly 180 bones.** She is rigged like a
  game character — spine chain, jaw/eyes/lids/brows/ears, a
  12-bone braid, 3 bones in every finger (30), a 48-bone skirt,
  apron panels, the bump, even a `babyKick` bone inside it.
  Every part of her is bound to its bone, and the rig is alive:
  her chest breathes, her head drifts gently, the braid and
  temple curls sway link by link, the skirt hem breathes — and
  every so often the bump bone fires and **the baby kicks**
  (watch her belly, and the little heart beside it).
- **Vertex count, measured: 19,904** — comfortably past the
  6,000-vertex floor (28,518 triangles). The play-test now
  asserts all three of the model's numbers at once: ≥6,000
  vertices, exactly 180 bones, 1–4 MB of model data.

## What's new in v0.3.1

- **She's Aerith now** (KH1's Aerith Gainsborough, by request):
  emerald-green eyes, gentler brows, softer pink lips, warm
  chestnut hair — the beehive is gone, replaced with her fringe,
  the two curled strands framing her face, and **her long braid
  down her back, tied with a pink ribbon** (plus a little bow
  where the braid begins).
- **Real model weight — 1–4 MB per character, as specified.**
  Her face is painted at **2048²** (iris striations, individual
  lashes, brow hairs, lip texture), her hair / dress / apron /
  skin textures at 1024² (skin has a subtle grain now), and her
  geometry is far denser (a 64×48-segment shaped head, 56-segment
  dress lathe, ~27,600 triangles in total). The game measures
  her true data size itself — about **3.3 MB** (textures as PNG
  bytes + geometry buffers, glTF-style accounting) — and the
  play-test asserts she stays inside the 1–4 MB band.

## What's new in v0.3.0

- **Every Mom-mode asset remade to Kingdom Hearts 1 quality.**
  The placeholder look is gone. Mom is a proper character now:
  a face painted in detail at 1024² (big brown eyes with iris
  gradients, pupils, twin highlights and lashed lids, brows, a
  small nose, rose lips, blush) on a shaped head — not a ball
  with a sticker. Strand-textured beehive with bangs, polka-dot
  dress fabric, a checked apron with ruffled hem and a pocket,
  collar, pearl necklace and earrings, a brooch, puff sleeves,
  **hands with fingers** (one resting on the bump), shaped legs
  and real heeled pumps. The room grew up too: a patterned
  oriental rug, stitched sofa fabric with a throw pillow, a TV
  that shows a little cartoon, a clock with numerals, patterned
  wallpaper, folded curtains, and more detail outside the window
  (clouds, the neighbour's door and chimney).

## What's new in v0.2.0

- **Mom mode begins — in full 3D.** Her living room as a real-time
  3D scene (the same Three.js engine as the womb): both dwellings
  with their own world outside the window, her furniture options as
  3D furniture, lamplight and TV glow, and a 3D mom who breathes,
  cradles her bump, and carries a little floating heart. Choices
  save between visits. Still growing: her 83-accessory wardrobe,
  her day loop, and the street with its neighbours — all playable
  today in the Android edition (v3.6/v3.7).

## What's in v0.1.0

- The full 3D womb: textured pulsing chamber, a sleeping baby (or 2,
  3, or 8) with cord and placenta, golden bubbles, drifting motes
  and vernix flakes, warm fog, and a heartbeat that lights the walls.
- All 3 levels (First Weeks / Growing / Almost Time), doubled womb
  sizes just like the Android v3.4 build, drifting bubbles in
  Almost Time.
- The synthesized womb soundtrack (heartbeat, blood whoosh, tummy
  gurgles, muffled voices) re-created with WebAudio — no audio
  files — plus the music-box lullaby from the Android app.
- A VRChat-style Quick Menu (Tab): floating glass panel, big
  tiles, live clock/fps, respawn, and every setting in one place.
- Four graphics eras, switchable live: Ouch Budget, KH3, Early
  2K (PS2), Early 90s (PS1).
- **Coming next:** Mom mode grows — her wardrobe (83 accessories),
  her day (rest / walk / tidy / rock, and the baby answering with
  kicks), and a walkable 3D street with the neighbours.

## Testing

`tests/cdp_test.mjs` plays the real game in headless Chromium
(SwiftShader WebGL): title screen, Mom mode's 3D home (both
dwellings, the decorate panel, a close-up of her remade face,
leaving and returning), entering, swimming, collecting a bubble,
all four graphics eras switching live, the Quick Menu (opening,
pausing the world, switching era from a tile, resuming), fetus
mode and kicking — with screenshots in `shots/` and a hard
fail on any page error. Latest run: **ALL PASS, no page errors**
(see `build-results.txt`).

*The simulation is a faithful port of the Android `GameWorld`. One
nerd note: the random generator is a mulberry32 instead of the Java
LCG — same seed family, same distributions, different dice rolls.*
