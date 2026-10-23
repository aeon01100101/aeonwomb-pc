"use strict";
/* Her living room — a faithful JS-canvas port of the Android
   MotherView scene (v3.6/v3.7), so Isaiah can SEE the house options
   before Mom mode lands in PC v0.2. Same proportions, same palettes,
   same furniture. Query params pick the options:
   d, wall, floor, sofa, curtains, rug, tv, decor, lamp, plant. */
const q = new URLSearchParams(location.search);
const P = {
  d: +(q.get("d") ?? 0), wall: +(q.get("wall") ?? 0), floor: +(q.get("floor") ?? 0),
  sofa: +(q.get("sofa") ?? 0), curtains: +(q.get("curtains") ?? 0), rug: +(q.get("rug") ?? 0),
  tv: +(q.get("tv") ?? 0), decor: +(q.get("decor") ?? 0), lamp: +(q.get("lamp") ?? 0),
  plant: +(q.get("plant") ?? 1)
};
const rgb = (r, g, b) => `rgb(${r},${g},${b})`;
const WALL_COLORS = [rgb(178,216,192), rgb(240,224,150), rgb(244,200,208), rgb(178,206,232), rgb(242,234,214), rgb(246,205,172)];
const SOFA_COLORS = [rgb(64,140,148), rgb(214,164,52), rgb(226,116,92), rgb(128,152,74), rgb(120,78,56), rgb(228,150,172)];
const CURTAIN_COLORS = [rgb(248,246,240), rgb(238,156,172), rgb(216,172,74), rgb(84,150,152)];
const RUG_COLORS = [rgb(156,44,52), rgb(64,140,148), rgb(238,170,190), rgb(178,140,96)];
const SKIN = rgb(246,199,160), HAIR = rgb(74,46,28), DRESSC = rgb(178,34,52);

const cv = document.getElementById("room");
const g = cv.getContext("2d");
const W = cv.width, H = cv.height;

function rect(x, y, w2, h2, col) { g.fillStyle = col; g.fillRect(x, y, w2, h2); }
function oval(x0, y0, x1, y1, col) {
  g.fillStyle = col; g.beginPath();
  g.ellipse((x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2, 0, 0, Math.PI * 2); g.fill();
}
function circle(x, y, r, col) { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
function rrect(x0, y0, x1, y1, r, col) {
  g.fillStyle = col; g.beginPath(); g.roundRect(x0, y0, x1 - x0, y1 - y0, r); g.fill();
}
function line(x0, y0, x1, y1, col, wdt, cap) {
  g.strokeStyle = col; g.lineWidth = wdt; g.lineCap = cap || "butt";
  g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
}
function pathDraw(pts, col) {
  g.fillStyle = col; g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath(); g.fill();
}

// ------------------------------------------------------------ scene (port)
function drawScene(w, h, groundY) {
  rect(0, 0, w, groundY, WALL_COLORS[P.wall]);
  g.globalAlpha = 36 / 255;
  for (let x = w * 0.04; x < w; x += w * 0.09) rect(x, 0, w * 0.018, groundY * 0.80, "#ffffff");
  g.globalAlpha = 1;
  const wainsY = groundY * 0.80;
  g.globalAlpha = 52 / 255; rect(0, wainsY, w, h * 0.012, rgb(120, 84, 60)); g.globalAlpha = 1;
  if (P.floor === 2) {
    const tile = w * 0.09;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 14; c++)
      rect(c * tile, wainsY + h * 0.012 + r * tile * 0.62, tile, tile * 0.62,
        (r + c) % 2 === 0 ? rgb(238, 234, 226) : rgb(46, 44, 48));
  } else {
    rect(0, wainsY + h * 0.012, w, h, P.floor === 0 ? rgb(146, 102, 64) : P.floor === 1 ? rgb(122, 146, 70) : rgb(214, 148, 162));
    if (P.floor === 0) {
      g.globalAlpha = 60 / 255;
      for (let y = wainsY + h * 0.05; y < h; y += h * 0.045) rect(0, y, w, 1.5, rgb(84, 54, 30));
      g.globalAlpha = 1;
    }
  }
  drawWindow(w, h);
  drawDecor(w, h);
  drawSofa(w, h, groundY);
  if (P.rug < 4) {
    g.globalAlpha = 215 / 255;
    oval(w * 0.30, groundY - h * 0.012, w * 0.92, groundY + h * 0.035, RUG_COLORS[P.rug]);
    g.globalAlpha = 1;
  }
  drawTv(w, h, groundY);
  drawLamp(w, h, groundY);
  drawPlant(w, h, groundY);
}
function drawWindow(w, h) {
  const x0 = w * 0.665, x1 = w * 0.975, y0 = h * 0.07, y1 = h * 0.44;
  if (P.d === 0) {
    rect(x0, y0, x1 - x0, y1 - y0, rgb(168, 212, 240));
    circle(x0 + (x1 - x0) * 0.76, y0 + (y1 - y0) * 0.24, w * 0.028, rgb(255, 216, 92));
    rect(x0 + (x1 - x0) * 0.06, y0 + (y1 - y0) * 0.44, (x1 - x0) * 0.34, (y1 - y0) * 0.18, rgb(146, 96, 70));
    pathDraw([[x0 + (x1 - x0) * 0.02, y0 + (y1 - y0) * 0.46], [x0 + (x1 - x0) * 0.23, y0 + (y1 - y0) * 0.30], [x0 + (x1 - x0) * 0.44, y0 + (y1 - y0) * 0.46]], rgb(110, 62, 44));
    rect(x0, y0 + (y1 - y0) * 0.62, x1 - x0, y1 - (y0 + (y1 - y0) * 0.62), rgb(120, 182, 92));
    for (let fx = x0 + 4; fx < x1 - 4; fx += w * 0.022)
      rect(fx, y0 + (y1 - y0) * 0.70, w * 0.008, (y1 - y0) * 0.16, rgb(250, 248, 242));
    rect(x0, y0 + (y1 - y0) * 0.76, x1 - x0, (y1 - y0) * 0.03, rgb(250, 248, 242));
  } else {
    rect(x0, y0, x1 - x0, y1 - y0, rgb(96, 108, 156));
    circle(x0 + (x1 - x0) * 0.82, y0 + (y1 - y0) * 0.16, w * 0.020, rgb(240, 236, 210));
    const bw = (x1 - x0) / 4.2;
    for (let i = 0; i < 4; i++) {
      const bx = x0 + i * bw * 1.04;
      const bh = (y1 - y0) * (0.45 + 0.13 * ((i * 37) % 3));
      rect(bx, y1 - bh, bw, bh, rgb(52, 56, 84));
      for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++)
        if ((r * 2 + c + i) % 3 !== 0)
          rect(bx + bw * (0.18 + c * 0.42), y1 - bh + bh * (0.12 + r * 0.2), bw * 0.20, bh * 0.12, rgb(255, 214, 120));
    }
    const tx = x0 + (x1 - x0) * 0.60, ty = y0 + (y1 - y0) * 0.10;
    rect(tx, ty, w * 0.045, w * 0.030, rgb(40, 42, 66));
    rect(tx + w * 0.008, ty + w * 0.030, w * 0.006, w * 0.045, rgb(40, 42, 66));
    rect(tx + w * 0.032, ty + w * 0.030, w * 0.006, w * 0.045, rgb(40, 42, 66));
  }
  g.strokeStyle = rgb(250, 248, 242); g.lineWidth = w * 0.010;
  g.strokeRect(x0, y0, x1 - x0, y1 - y0);
  line((x0 + x1) / 2, y0, (x0 + x1) / 2, y1, rgb(250, 248, 242), w * 0.010);
  rect(x0 - w * 0.012, y1, (x1 - x0) + w * 0.024, h * 0.014, rgb(250, 248, 242));
  if (P.curtains < 4) {
    const cw = (x1 - x0) * 0.20;
    rect(x0 - w * 0.006, y0 - h * 0.008, cw + w * 0.006, y1 * 0.98 - (y0 - h * 0.008), CURTAIN_COLORS[P.curtains]);
    rect(x1 - cw, y0 - h * 0.008, cw + w * 0.006, y1 * 0.98 - (y0 - h * 0.008), CURTAIN_COLORS[P.curtains]);
    rect(x0 - w * 0.006, y0 - h * 0.008, (x1 - x0) + w * 0.012, h * 0.030, CURTAIN_COLORS[P.curtains]);
    if (P.curtains === 1) {
      g.globalAlpha = 70 / 255;
      for (let gx = x0; gx < x0 + cw; gx += w * 0.016) rect(gx, y0, w * 0.006, y1 - y0, "#ffffff");
      for (let gx = x1 - cw; gx < x1; gx += w * 0.016) rect(gx, y0, w * 0.006, y1 - y0, "#ffffff");
      g.globalAlpha = 1;
    }
  }
}
function drawDecor(w, h) {
  const cx = w * 0.30, cy = h * 0.17;
  if (P.decor === 0 || P.decor === 2) {
    g.strokeStyle = rgb(196, 148, 52); g.lineWidth = 2.5;
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6;
      const r0 = w * 0.030, r1 = w * (i % 2 === 0 ? 0.052 : 0.042);
      line(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1, rgb(196, 148, 52), 2.5);
    }
    circle(cx, cy, w * 0.030, P.decor === 0 ? rgb(250, 244, 226) : rgb(206, 226, 236));
    if (P.decor === 0) {
      line(cx, cy, cx + w * 0.014, cy - w * 0.016, rgb(52, 44, 40), 2);
      line(cx, cy, cx - w * 0.018, cy + w * 0.006, rgb(52, 44, 40), 2);
    }
  } else if (P.decor === 1) {
    rect(cx - w * 0.055, cy - h * 0.055, w * 0.11, h * 0.11, rgb(120, 84, 48));
    rect(cx - w * 0.047, cy - h * 0.047, w * 0.094, h * 0.094, rgb(238, 228, 208));
    circle(cx - w * 0.012, cy - h * 0.020, w * 0.013, SKIN);
    circle(cx - w * 0.006, cy + h * 0.016, w * 0.024, DRESSC);
    g.globalAlpha = 120 / 255;
    circle(cx + w * 0.026, cy + h * 0.026, w * 0.008, rgb(255, 120, 130));
    g.globalAlpha = 1;
  } else {
    rect(cx - w * 0.065, cy - h * 0.045, w * 0.13, h * 0.09, rgb(120, 84, 48));
    rect(cx - w * 0.057, cy - h * 0.037, w * 0.114, h * 0.074, rgb(178, 214, 238));
    circle(cx + w * 0.032, cy - h * 0.018, w * 0.011, rgb(255, 216, 92));
    g.fillStyle = rgb(110, 168, 92);
    g.beginPath(); g.ellipse(cx - w * 0.035, cy + h * 0.035, w * 0.04, h * 0.04, 0, Math.PI, 2 * Math.PI); g.fill();
    g.beginPath(); g.ellipse(cx + w * 0.035, cy + h * 0.042, w * 0.04, h * 0.04, 0, Math.PI, 2 * Math.PI); g.fill();
  }
}
function drawSofa(w, h, groundY) {
  const sofa = SOFA_COLORS[P.sofa];
  const x0 = w * 0.015, x1 = w * 0.46;
  const backY = groundY - h * 0.30, seatY = groundY - h * 0.155;
  rrect(x0, backY, x1, seatY + h * 0.03, h * 0.03, sofa);
  g.globalAlpha = 40 / 255;
  rect(x0 + (x1 - x0) * 0.48, backY + h * 0.01, (x1 - x0) * 0.02, seatY - backY - h * 0.01, "#000");
  g.globalAlpha = 1;
  rrect(x0 - w * 0.004, seatY, x1 + w * 0.004, groundY - h * 0.02, h * 0.025, sofa);
  circle(x0 + w * 0.018, seatY + h * 0.01, h * 0.035, sofa);
  g.globalAlpha = 52 / 255;
  rect(x0 + w * 0.01, groundY - h * 0.02, w * 0.02, h * 0.02, "#000");
  rect(x1 - w * 0.03, groundY - h * 0.02, w * 0.02, h * 0.02, "#000");
  g.globalAlpha = 1;
}
function drawTv(w, h, groundY) {
  const cx = w * 0.865;
  if (P.tv === 0) {
    const bw = w * 0.20, bh = h * 0.155, by = groundY - bh - h * 0.045;
    rrect(cx - bw / 2, by, cx + bw / 2, by + bh, 8, rgb(122, 80, 48));
    rrect(cx - bw * 0.44, by + bh * 0.14, cx + bw * 0.08, by + bh * 0.86, 12, rgb(186, 214, 206));
    circle(cx - bw * 0.18, by + bh * 0.50, bw * 0.10, rgb(240, 236, 210));
    circle(cx + bw * 0.30, by + bh * 0.30, w * 0.010, rgb(60, 40, 26));
    circle(cx + bw * 0.30, by + bh * 0.62, w * 0.010, rgb(60, 40, 26));
    rect(cx - bw * 0.36, by + bh, bw * 0.06, groundY - (by + bh), rgb(122, 80, 48));
    rect(cx + bw * 0.30, by + bh, bw * 0.06, groundY - (by + bh), rgb(122, 80, 48));
  } else if (P.tv === 1) {
    const bw = w * 0.15, bh = h * 0.115, by = groundY - bh - h * 0.13;
    line(cx, by, cx - bw * 0.3, by - h * 0.07, rgb(52, 48, 46), 2);
    line(cx, by, cx + bw * 0.34, by - h * 0.055, rgb(52, 48, 46), 2);
    rrect(cx - bw / 2, by, cx + bw / 2, by + bh, 8, rgb(84, 84, 92));
    rrect(cx - bw * 0.42, by + bh * 0.16, cx + bw * 0.16, by + bh * 0.84, 8, rgb(186, 214, 206));
    rect(cx - bw * 0.55, by + bh + h * 0.012, bw * 1.1, h * 0.014, rgb(110, 74, 44));
    rect(cx - bw * 0.44, by + bh + h * 0.026, bw * 0.06, groundY - (by + bh + h * 0.026), rgb(110, 74, 44));
    rect(cx + bw * 0.38, by + bh + h * 0.026, bw * 0.06, groundY - (by + bh + h * 0.026), rgb(110, 74, 44));
  } else {
    const bw = w * 0.13, bh = h * 0.075, by = groundY - bh - h * 0.115;
    line(cx + bw * 0.2, by, cx + bw * 0.55, by - h * 0.09, rgb(60, 40, 26), 2);
    rrect(cx - bw / 2, by, cx + bw / 2, by + bh, 8, rgb(150, 96, 54));
    circle(cx - bw * 0.22, by + bh / 2, bw * 0.17, rgb(240, 226, 180));
    circle(cx + bw * 0.26, by + bh / 2, w * 0.009, rgb(60, 40, 26));
    rect(cx - bw * 0.52, by + bh + h * 0.010, bw * 1.04, h * 0.012, rgb(110, 74, 44));
    rect(cx - bw * 0.42, by + bh + h * 0.022, bw * 0.06, groundY - (by + bh + h * 0.022), rgb(110, 74, 44));
    rect(cx + bw * 0.36, by + bh + h * 0.022, bw * 0.06, groundY - (by + bh + h * 0.022), rgb(110, 74, 44));
  }
}
function drawLamp(w, h, groundY) {
  if (P.lamp === 2) return;
  const lx = P.lamp === 0 ? w * 0.055 : w * 0.505;
  const shadeY = P.lamp === 0 ? groundY - h * 0.36 : groundY - h * 0.235;
  g.globalAlpha = 52 / 255;
  circle(lx, shadeY + h * 0.02, w * 0.075, rgb(255, 214, 140));
  g.globalAlpha = 1;
  if (P.lamp === 1) {
    rect(lx - w * 0.035, groundY - h * 0.155, w * 0.07, h * 0.012, rgb(110, 74, 44));
    rect(lx - w * 0.026, groundY - h * 0.143, w * 0.006, h * 0.143, rgb(110, 74, 44));
    rect(lx + w * 0.020, groundY - h * 0.143, w * 0.006, h * 0.143, rgb(110, 74, 44));
    rect(lx - w * 0.004, groundY - h * 0.175, w * 0.008, h * 0.020, rgb(70, 50, 34));
  } else {
    rect(lx - w * 0.004, shadeY + h * 0.035, w * 0.008, groundY - shadeY - h * 0.035, rgb(70, 50, 34));
    oval(lx - w * 0.022, groundY - h * 0.008, lx + w * 0.022, groundY + h * 0.004, rgb(70, 50, 34));
  }
  pathDraw([[lx - w * 0.020, shadeY], [lx + w * 0.020, shadeY], [lx + w * 0.032, shadeY + h * 0.042], [lx - w * 0.032, shadeY + h * 0.042]], rgb(246, 220, 160));
}
function drawPlant(w, h, groundY) {
  if (P.plant === 0) return;
  const px = w * 0.635;
  if (P.plant === 1) {
    pathDraw([[px - w * 0.020, groundY - h * 0.045], [px + w * 0.020, groundY - h * 0.045], [px + w * 0.014, groundY], [px - w * 0.014, groundY]], rgb(168, 92, 54));
    for (let i = -3; i <= 3; i++) {
      const a = -Math.PI / 2 + i * 0.30;
      line(px, groundY - h * 0.045, px + Math.cos(a) * w * 0.045, groundY - h * 0.045 + Math.sin(a) * w * 0.045, rgb(74, 138, 74), 2.5, "round");
    }
  } else {
    const vy = h * 0.455;
    rrect(px - w * 0.010, vy, px + w * 0.010, vy + h * 0.035, 4, rgb(84, 140, 168));
    line(px, vy, px - w * 0.012, vy - h * 0.022, rgb(74, 138, 74), 2);
    line(px, vy, px + w * 0.012, vy - h * 0.022, rgb(74, 138, 74), 2);
    line(px, vy, px, vy - h * 0.028, rgb(74, 138, 74), 2);
    circle(px - w * 0.014, vy - h * 0.026, w * 0.008, rgb(232, 92, 108));
    circle(px + w * 0.014, vy - h * 0.026, w * 0.008, rgb(246, 190, 84));
    circle(px, vy - h * 0.034, w * 0.009, rgb(238, 140, 180));
  }
}

// ------------------------------------------------------------ her (default outfit, week 30)
function drawHer(w, h, groundY) {
  const H = h * 0.78, topY = groundY - H, cx = w * 0.60;
  const headR = H * 0.085;
  const headCx = cx - H * 0.01, headCy = topY + headR * 1.1;
  const bellyR = H * 0.124; // week 30
  const bellyCx = cx - H * 0.115 - bellyR * 0.30, bellyCy = topY + H * 0.52;
  const hemY = groundY - H * 0.17, hemF = 0.178, hemB = 0.158;
  g.globalAlpha = 60 / 255;
  oval(cx - H * 0.22, groundY - H * 0.015, cx + H * 0.22, groundY + H * 0.02, "#000");
  g.globalAlpha = 1;
  // legs + red kitten heels
  line(cx - H * 0.085, hemY, cx - H * 0.095, groundY - H * 0.02, SKIN, H * 0.042, "round");
  line(cx + H * 0.055, hemY, cx + H * 0.075, groundY - H * 0.02, SKIN, H * 0.042, "round");
  pathDraw([[cx - H * 0.125, groundY], [cx - H * 0.125, groundY - H * 0.028], [cx - H * 0.082, groundY - H * 0.026], [cx - H * 0.075, groundY]], rgb(178, 34, 52));
  pathDraw([[cx + H * 0.0725, groundY], [cx + H * 0.0725, groundY - H * 0.028], [cx + H * 0.115, groundY - H * 0.026], [cx + H * 0.122, groundY]], rgb(178, 34, 52));
  // dress over the bump (the real dressPath from MotherView)
  g.fillStyle = DRESSC;
  g.beginPath();
  g.moveTo(cx - H * 0.048, topY + H * 0.155);
  g.quadraticCurveTo(bellyCx - bellyR * 0.62, bellyCy - bellyR * 1.08, bellyCx - bellyR * 0.99, bellyCy - bellyR * 0.12);
  g.quadraticCurveTo(bellyCx - bellyR * 0.72, bellyCy + bellyR * 0.98, cx - H * hemF, hemY);
  g.lineTo(cx + H * hemB, hemY);
  g.quadraticCurveTo(cx + H * 0.118, topY + H * 0.40, cx + H * 0.056, topY + H * 0.15);
  g.quadraticCurveTo(cx, topY + H * 0.115, cx - H * 0.048, topY + H * 0.155);
  g.closePath(); g.fill();
  g.globalAlpha = 46 / 255;
  g.fillStyle = "#000";
  g.beginPath();
  g.moveTo(bellyCx - bellyR * 0.72, bellyCy + bellyR * 0.90);
  g.quadraticCurveTo(bellyCx - bellyR * 0.2, bellyCy + bellyR * 1.10, cx - H * 0.10, hemY);
  g.lineTo(cx - H * hemF, hemY);
  g.quadraticCurveTo(bellyCx - bellyR * 0.72, bellyCy + bellyR * 0.98, bellyCx - bellyR * 0.72, bellyCy + bellyR * 0.90);
  g.closePath(); g.fill();
  g.globalAlpha = 1;
  // arm, hand resting on the bump
  const handX = bellyCx - bellyR * 0.38, handY = bellyCy - bellyR * 0.30;
  const elbowX = cx - H * 0.078, elbowY = topY + H * 0.335;
  line(cx - H * 0.02, topY + H * 0.20, elbowX, elbowY, DRESSC, H * 0.052, "round");
  line(elbowX, elbowY, handX, handY, SKIN, H * 0.038, "round");
  circle(handX, handY, H * 0.021, SKIN);
  // head + face in profile
  circle(headCx, headCy, headR, SKIN);
  // beehive hair
  g.fillStyle = HAIR;
  g.beginPath(); g.ellipse(headCx + headR * 0.08, headCy - headR * 0.52, headR * 0.92, headR * 1.02, 0, Math.PI, 2 * Math.PI); g.fill();
  g.beginPath(); g.ellipse(headCx + headR * 0.10, headCy - headR * 1.06, headR * 0.52, headR * 0.55, 0, 0, Math.PI * 2); g.fill();
  rect(headCx + headR * 0.55, headCy - headR * 0.6, headR * 0.35, headR * 1.1, HAIR);
  circle(headCx - headR * 0.52, headCy - headR * 0.02, headR * 0.09, rgb(58, 34, 30));
  g.strokeStyle = rgb(58, 34, 30); g.lineWidth = Math.max(1.5, headR * 0.07);
  g.beginPath(); g.arc(headCx - headR * 0.53, headCy + headR * 0.18, headR * 0.25, Math.PI * 0.15, Math.PI * 0.75); g.stroke();
  g.globalAlpha = 110 / 255;
  circle(headCx - headR * 0.30, headCy + headR * 0.38, headR * 0.20, rgb(255, 120, 120));
  g.globalAlpha = 1;
  // her heart by the bump
  const hs = H * 0.020, hx = bellyCx - bellyR - H * 0.045, hy = bellyCy - bellyR - H * 0.045;
  g.globalAlpha = 200 / 255; g.fillStyle = rgb(255, 120, 130);
  g.beginPath(); g.arc(hx - hs * 0.36, hy - hs * 0.18, hs * 0.55, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(hx + hs * 0.36, hy - hs * 0.18, hs * 0.55, 0, Math.PI * 2); g.fill();
  pathDraw([[hx - hs * 0.82, hy - hs * 0.02], [hx + hs * 0.82, hy - hs * 0.02], [hx, hy + hs * 0.95]], rgb(255, 120, 130));
  g.globalAlpha = 1;
}

// ------------------------------------------------------------ page labels + draw
const NAMES = {
  d: ["Suburban House", "City Apartment"],
  wall: ["Mint", "Butter", "Blush Pink", "Sky", "Cream", "Peach"],
  floor: ["Hardwood", "Avocado Carpet", "Checkered Tile", "Rose Carpet"],
  sofa: ["Teal Sofa", "Mustard Sofa", "Coral Sofa", "Avocado Sofa", "Chocolate Sofa", "Pink Sofa"],
  curtains: ["White Lace", "Pink Gingham", "Gold Drapes", "Teal Drapes", "No Curtains"],
  rug: ["Oriental Red", "Teal Oval", "Pink Shag", "Braided Rug", "No Rug"],
  tv: ["Console TV", "Portable TV", "Radio"],
  decor: ["Sunburst Clock", "Family Portrait", "Starburst Mirror", "Landscape Painting"],
  lamp: ["Floor Lamp", "Table Lamp", "No Lamp"],
  plant: ["No Plant", "Fern", "Vase of Flowers"]
};
document.getElementById("title").textContent = (P.d === 0 ? "🏠 " : "🏢 ") + NAMES.d[P.d];
document.getElementById("subtitle").textContent =
  `${NAMES.wall[P.wall]} walls · ${NAMES.floor[P.floor]} · ${NAMES.sofa[P.sofa]} · ${NAMES.tv[P.tv]}`;
document.getElementById("opts").textContent =
  `Shown: ${NAMES.curtains[P.curtains]} · ${NAMES.rug[P.rug]} · ${NAMES.decor[P.decor]} · ${NAMES.lamp[P.lamp]} · ${NAMES.plant[P.plant]}. ` +
  `Full menu in the app: 2 homes × 6 wallpapers × 4 floors × 6 sofas × 5 curtains × 5 rugs × 3 TV/radio × 4 wall decor × 3 lamps × 3 plants = 41 choices.`;
const groundY = H * 0.96;
drawScene(W, H, groundY);
drawHer(W, H, groundY);
window.__ready = true;
