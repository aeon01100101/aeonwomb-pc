// ============================================================
// Aeon Womb PC — CONTENT REGISTRY
// Every outside-built piece declares itself here, once, as data.
// The game reads this file and does the rest by itself: builds
// the piece, stands it at its spot, gives it a collision box,
// and ticks its animation every frame.
//
// To add a piece: one entry. No game.js surgery.
//
//   builder   name of the global build function (content lane)
//   scene     "town" (placed while the town is built, gets
//             zoned + may carry a collision box) or "home"
//             (placed in her home interior)
//   at        [x, z] — centre of the piece, metres
//   ry        facing, radians (optional)
//   copies    [[x, z], ...] — several of the same piece; `at`
//             is then not needed
//   solidSize [w, d] — a collision box that size, centred on
//             the piece (town pieces only)
//
// The mailbox is NOT here: it is hand-wired on purpose, because
// its flag is driven by the parts mail system.
// ============================================================
const CONTENT_REGISTRY = [
  // ---- town dressing (Grok, content lane) ----
  { builder: "buildFireHydrant", scene: "town", at: [-22.5, 31.5], solidSize: [0.4, 0.4] },
  { builder: "buildParkBench", scene: "town", copies: [[-11, 31.3], [17.5, 31.3]], ry: Math.PI, solidSize: [1.8, 0.6] },
  { builder: "buildStreetLamp", scene: "town", copies: [[-20, 31.6], [-10, 31.6], [0, 31.6], [10, 31.6], [20, 31.6]] },
  { builder: "buildPhoneBooth", scene: "town", at: [11.8, 31.2], ry: Math.PI, solidSize: [0.8, 0.8] },

  // ---- her home (Grok, content lane) ----
  { builder: "buildKitchenSet", scene: "home", at: [-2.6, 3.15], ry: Math.PI },
  { builder: "buildNurserySet", scene: "home", at: [3.35, 2.35], ry: Math.PI }
];
