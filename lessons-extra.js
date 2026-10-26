/* SlabLab – Learn, Stage 49: two new topics (4 lessons)
   7 · Equivalent Frame Method (concept + worked example)     8 · Punching Shear (concept + worked example)
   Added to SL_LEARN.topics at load time, so the Learn screen, progress ring and slide player pick them up automatically.
   Every number in the worked examples is computed by the app's own engines (SL_FLAT, SL_ACID) from fixed inputs. */
(function (root) {
  'use strict';
  const LN = root.SL_LEARN, FL = root.SL_FLAT, AC = root.SL_ACID, E = root.SL, g = E.g;
  if (!LN || !FL || !AC) return;
  const C = { gr: '#12C26B', gr2: '#0C9A55', cy: '#1DD3F0', cy2: '#0DAFCB', mu: '#9FB8B0', con: '#C8D4D0', conD: '#8FA39C', dk: '#0A0F0D', wh: '#FFFFFF', am: '#F5A524', rd: '#EF4444' };
  const P = t => `<p>${t}</p>`, UL = a => `<ul>${a.map(t => `<li>${t}</li>`).join('')}</ul>`;
  const EQ = (label, formula, note, hl) => `<div class="eq${hl ? ' hl' : ''}"><small>${label}</small><code>${formula}</code>${note ? `<span${/^\s*=|<b>|[✓✗]/.test(note) ? ' class="n"' : ''}>${note}</span>` : ''}</div>`;
  const CALL = (t, k) => `<div class="cl${k ? ' ' + (k === 'am' ? 'warn' : k) : ''}">${t}</div>`;
  const FIG = (s, cap) => `<div class="fg">${s}</div>${cap ? `<p class="cap">${cap}</p>` : ''}`;
  const MT = a => `<div class="mt2">${a.map(([l, v, u]) => `<div>${l}<b>${v}</b>${u || ''}</div>`).join('')}</div>`;
  const CHIPS = a => `<div class="chs">${a.map(([t, k]) => `<span class="chip ${k || 'ok'}">${t}</span>`).join('')}</div>`;
  const KV = a => `<div class="kv">${a.map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('')}</div>`;
  const SD = (tag, h, html) => ({ tag, h, html });
  const svg = (vb, body) => `<svg viewBox="${vb}" role="img" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
  const tx = (x, y, t, o = {}) => `<text x="${x}" y="${y}" font-size="${o.s || 9}" font-weight="${o.w || 500}" fill="${o.c || C.mu}" text-anchor="${o.a || 'middle'}">${t}</text>`;
  const ln = (x1, y1, x2, y2, col, w, dash, cls, dl) => `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${col}" stroke-width="${w || 1.2}" fill="none"${dash ? ` stroke-dasharray="${dash}"` : ''}${cls === 'dr' && !dash ? ' class="dr" pathLength="1"' : (cls ? ' class="fd"' : '')}${dl ? ` style="animation-delay:${dl}s"` : ''}/>`;
  function arr(x1, y1, x2, y2, col, w, hs, cls, dl) {
    col = col || C.cy; w = w || 1.5; hs = hs || 5;
    const a = Math.atan2(y2 - y1, x2 - x1), hx = x2 - hs * Math.cos(a), hy = y2 - hs * Math.sin(a), px = -Math.sin(a) * hs * 0.55, py = Math.cos(a) * hs * 0.55;
    return `<path d="M${x1} ${y1}L${hx.toFixed(1)} ${hy.toFixed(1)}" stroke="${col}" stroke-width="${w}" fill="none"${cls ? ` class="${cls}" pathLength="1"` : ''}${dl ? ` style="animation-delay:${dl}s"` : ''}/><path d="M${x2} ${y2}L${(hx + px).toFixed(1)} ${(hy + py).toFixed(1)}L${(hx - px).toFixed(1)} ${(hy - py).toFixed(1)}z" fill="${col}"/>`;
  }
  const dim = (x1, y1, x2, y2, col) => arr(x1, y1, x2, y2, col || C.cy, 1, 4) + arr(x2, y2, x1, y1, col || C.cy, 1, 4);
  const pop = (inner, dl) => `<g class="pp" style="animation:pop .6s ${dl || 0}s both;transform-box:fill-box;transform-origin:center">${inner}</g>`;
  const rect = (x, y, w, h, fill, st, dl) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${st ? ` stroke="${st}"` : ''}${dl != null ? ` class="fd" style="animation-delay:${dl}s"` : ''}/>`;
  const TITLE = (T, kind, h, sub) => ({ title: true, topic: T.name, icon: T.icon, kind, h, sub });
  const f1 = x => Number(x).toFixed(1), f2 = x => Number(x).toFixed(2), f0 = x => Math.round(x);

  /* ------------------------------------------------------------ worked examples (fixed inputs) */
  let _e1 = null, _e2 = null;
  function EX1() {         // RC_project frame: 3 spans 5 · 4 · 5 m, l2 = 4 m, h = 170, columns 400 × 250, H = 4.5 m
    if (_e1) return _e1;
    const c = Object.assign({}, E.DEF), A = (v, k) => Array(k).fill(v);
    const S = { L: [5, 4, 5], b: A(4, 3), h: A(170, 3), g: A(6.25, 3), q: A(5, 3), c1: A(400, 4), c2: A(250, 4), Ha: A(4.5, 4), Hb: A(4.5, 4), pos: ['Edge', 'Interior', 'Interior', 'Edge'] };
    const oE = { gG: 1.35, gQ: 1.5, sG: 1, sQ: 0.3, fx: 4, tor: 0, ax: 1 }, oA = Object.assign({}, oE, { gG: 1.2, gQ: 1.6, pat: 'aci' });
    const RE = FL.efm(S, oE), RA = FL.efm(S, oA), I = 0.25 * 0.4 ** 3 / 12, Kc = 4 * I / 4.5 * 2, Ks = 4 * 4 * 0.17 ** 3 / 12 / 5;
    _e1 = { c, S, RE, RA, I, Kc, Ks, D: FL.design(RE, c, { basis: 'span', layer: 'outer', phi: 12, sn: 70, sp: 60 }), DA: AC.flat(RA, c, { basis: 'span', layer: 'outer', phi: 12, aciStrip: 'aci' }) };
    return _e1;
  }
  function EX2() {         // 4 spans 6 · 7.5 · 7.5 · 6, l2 = 5, h = 220, columns 350 × 350: the interior column B needs punching reinforcement
    if (_e2) return _e2;
    const c = Object.assign({}, E.DEF), A = (v, k) => Array(k).fill(v);
    const S = { L: [6, 7.5, 7.5, 6], b: A(5, 4), h: A(220, 4), g: A(7, 4), q: A(3, 4), c1: A(350, 5), c2: A(350, 5), Ha: A(3.2, 5), Hb: A(3.2, 5), pos: ['Edge', 'Interior', 'Interior', 'Interior', 'Edge'] };
    const oE = { gG: 1.35, gQ: 1.5, sG: 1, sQ: 0.3, fx: 4, tor: 1, ax: 1 }, oA = Object.assign({}, oE, { gG: 1.2, gQ: 1.6, pat: 'aci' });
    const RE = FL.efm(S, oE), RA = FL.efm(S, oA), D = FL.design(RE, c, { basis: 'span', layer: 'outer', phi: 12, sn: 70, sp: 60 }), DA = AC.flat(RA, c, { basis: 'span', layer: 'outer', phi: 12, aciStrip: 'aci' });
    _e2 = { c, S, RE, RA, D, DA, pe: D.punch[1], pa: DA.punch[1] };
    return _e2;
  }

  /* ------------------------------------------------------------ figures */
  function figPlan() {      // plan of a flat slab with the two equivalent frames highlighted
    let s = '';
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) s += rect(40 + i * 70 - 7, 24 + j * 44 - 7, 14, 14, C.conD);
    s += rect(33, 41, 214, 30, 'rgba(18,194,107,.22)', C.gr, 0.3) + tx(256, 60, 'frame', { c: C.gr, s: 8, w: 700, a: 'start' });
    s += rect(33, 3, 14, 130, 'rgba(29,211,240,.0)') + `<path d="M103 8V128" stroke="${C.cy}" stroke-width="1.2" stroke-dasharray="4 3" class="fd" style="animation-delay:.8s"/>`;
    s += dim(40, 100, 110, 100, C.am) + tx(75, 112, 'l1', { c: C.am, w: 700, s: 9 }) + dim(14, 24, 14, 68, C.cy) + tx(8, 50, 'l2', { c: C.cy, w: 700, s: 9, a: 'end' });
    return svg('0 0 300 128', s + tx(150, 124, 'the strip between panel centre-lines becomes a 2-D frame', { s: 8 }));
  }
  function figFrame() {     // equivalent frame elevation: slab-beams + columns + torsion springs
    let s = '', x = [40, 130, 220];
    s += ln(30, 62, 250, 62, C.con, 7, '', '') + udl3();
    x.forEach((xx, i) => { s += rect(xx - 7, 20, 14, 42, C.conD) + rect(xx - 7, 66, 14, 42, C.conD) + `<circle cx="${xx}" cy="64" r="5" fill="none" stroke="${C.am}" stroke-width="1.6" class="fd" style="animation-delay:${.4 + i * .2}s"/>`; s += tx(xx, 122, 'ABC'[i], { c: C.cy, w: 700, s: 10 }); });
    s += tx(85, 80, 'slab-beam', { c: C.gr, w: 700, s: 8.5 }) + tx(175, 80, 'slab-beam', { c: C.gr, w: 700, s: 8.5 }) + tx(70, 30, 'column', { s: 8, a: 'end' }) + tx(262, 56, 'torsion', { c: C.am, s: 8, w: 700, a: 'start' }) + arr(258, 58, 228, 64, C.am, 1, 4, 'dr', 1);
    return svg('0 0 300 128', s);
    function udl3() { let a = ''; for (let i = 0; i < 12; i++) a += arr(38 + i * 18, 40, 38 + i * 18, 58, C.gr, 1.1, 3.5); return a; }
  }
  function figPatterns() {  // pattern loading cases
    const rows = [['A · all spans', [1, 1, 1]], ['B · alternate', [1, 0, 1]], ['C · adjacent', [0, 1, 1]]];
    let s = '';
    rows.forEach(([t, w], r) => {
      const y = 12 + r * 40;
      s += ln(30, y + 28, 270, y + 28, C.con, 5, '', '') + tx(28, y + 14, t, { s: 8, c: C.mu, a: 'start' });
      w.forEach((on, i) => { const a = 70 + i * 66; if (on) { s += `<path d="M${a} ${y + 12}H${a + 66}" stroke="${C.gr}" stroke-width="1.2"/>`; for (let k = 0; k < 4; k++) s += arr(a + 8 + k * 17, y + 12, a + 8 + k * 17, y + 25, C.gr, 1, 3.5, 'fd', r * .3 + i * .1); } else s += `<path d="M${a + 6} ${y + 21}H${a + 60}" stroke="${C.mu}" stroke-width="1.2" stroke-dasharray="3 3"/>`; });
      [70, 136, 202, 268].forEach(x => { s += `<path d="M${x - 5} ${y + 40}L${x} ${y + 31}L${x + 5} ${y + 40}z" fill="${C.wh}" opacity=".7"/>`; });
    });
    return svg('0 0 300 132', s);
  }
  function figStrips() {    // column strip / middle strip
    return svg('0 0 300 120', rect(30, 14, 240, 92, 'rgba(200,212,208,.18)', C.conD) + rect(30, 14, 240, 22, 'rgba(18,194,107,.28)', C.gr, 0.2) + rect(30, 84, 240, 22, 'rgba(18,194,107,.28)', C.gr, 0.4) + rect(30, 36, 240, 48, 'rgba(29,211,240,.2)', C.cy, 0.6) +
      tx(150, 29, 'column strip · 0.25·min(l1, l2)', { c: C.gr, s: 8.5, w: 700 }) + tx(150, 64, 'middle strip', { c: C.cy, s: 9, w: 700 }) + tx(150, 99, 'column strip', { c: C.gr, s: 8.5, w: 700 }) + [60, 150, 240].map(x => rect(x - 7, 29, 14, 14, C.conD) + rect(x - 7, 77, 14, 14, C.conD)).join(''));
  }
  function figCone() {      // punching cone
    return svg('0 0 300 170',
      rect(20, 70, 260, 26, C.con, C.conD) + rect(128, 96, 44, 60, C.conD) + rect(128, 14, 44, 56, C.conD, '') +
      `<path d="M128 96L84 70M172 96L216 70" stroke="${C.rd}" stroke-width="2.4" class="dr" pathLength="1"/>` + `<path d="M84 70L128 96M216 70L172 96" stroke="${C.rd}" stroke-width="0" />` +
      [40, 62, 84, 216, 238, 260].map((x, i) => arr(x, 40, x, 66, C.gr, 1.3, 4, 'fd', i * .08)).join('') + tx(150, 34, 'wu', { c: C.gr, w: 700, s: 10 }) +
      arr(150, 158, 150, 118, C.am, 2, 6, 'dr', 1) + tx(180, 140, 'V = column reaction', { c: C.am, w: 700, s: 8.5, a: 'start' }) +
      tx(62, 112, 'cone ≈ 35–45°', { c: C.rd, s: 8.5, w: 700 }) + dim(240, 70, 240, 96, C.cy) + tx(250, 86, 'd', { c: C.cy, w: 700, s: 9, a: 'start' }));
  }
  function figPerim() {     // critical perimeters: EC2 at 2d, ACI at d/2
    const cx = 120, cy = 76, c = 30, d = 14, a1 = 2 * d + c, a2 = d / 2 + c;
    return svg('0 0 300 150',
      rect(cx - c / 2, cy - c / 2, c, c, C.conD, C.wh) +
      `<rect x="${cx - c / 2 - 2 * d}" y="${cy - c / 2 - 2 * d}" width="${c + 4 * d}" height="${c + 4 * d}" rx="${2 * d}" fill="rgba(29,211,240,.08)" stroke="${C.cy}" stroke-width="1.6" stroke-dasharray="5 3" class="fd" style="animation-delay:.3s"/>` +
      `<rect x="${cx - c / 2 - d / 2}" y="${cy - c / 2 - d / 2}" width="${c + d}" height="${c + d}" fill="rgba(18,194,107,.14)" stroke="${C.gr}" stroke-width="1.8" class="fd" style="animation-delay:.8s"/>` +
      dim(cx + c / 2, cy, cx + c / 2 + 2 * d, cy, C.cy) + tx(cx + c / 2 + d, cy - 4, '2d', { c: C.cy, w: 700, s: 8 }) + dim(cx, cy - c / 2, cx, cy - c / 2 - d / 2, C.gr) +
      tx(236, 44, 'EC2 · u1 at 2d', { c: C.cy, w: 700, s: 9 }) + tx(236, 58, 'rounded corners', { s: 8 }) + tx(236, 92, 'ACI · b0 at d/2', { c: C.gr, w: 700, s: 9 }) + tx(236, 106, 'straight sides', { s: 8 }) + tx(120, 144, 'interior column · plan', { s: 8 }));
  }
  function figEdge() {      // edge and corner critical sections
    const edge = (x0, lab) => rect(x0, 18, 4, 70, C.rd) + rect(x0 + 4, 40, 28, 26, C.conD, C.wh) + `<path d="M${x0 + 4} 28H${x0 + 52}V78H${x0 + 4}" fill="rgba(18,194,107,.14)" stroke="${C.gr}" stroke-width="1.8" class="dr" pathLength="1"/>` + tx(x0 + 30, 104, lab, { s: 8.5, w: 700, c: C.mu });
    const cor = x0 => rect(x0, 18, 4, 70, C.rd) + rect(x0, 18, 70, 4, C.rd) + rect(x0 + 4, 22, 26, 26, C.conD, C.wh) + `<path d="M${x0 + 4} 62H${x0 + 52}V22" fill="rgba(18,194,107,.14)" stroke="${C.gr}" stroke-width="1.8" class="dr" pathLength="1" style="animation-delay:.4s"/>` + tx(x0 + 30, 104, 'corner · 2 sides', { s: 8.5, w: 700, c: C.mu });
    return svg('0 0 300 120', edge(24, 'edge · 3 sides') + cor(170) + tx(150, 117, 'red line = free slab edge · green = critical section', { s: 8 }));
  }
  function figStress() {    // shear stress around the perimeter: uniform + moment part
    return svg('0 0 300 150',
      rect(70, 50, 160, 14, C.con) + rect(135, 64, 30, 40, C.conD) +
      `<polygon points="70,40 230,40 230,22 70,22" fill="rgba(245,197,24,.18)" stroke="${C.am}" stroke-width="1.3" class="fd" style="animation-delay:.2s"/>` + tx(150, 17, 'V / (u·d)  uniform part', { c: C.am, w: 700, s: 8.5 }) +
      `<polygon points="70,104 70,86 230,122 230,140" fill="none"/>` +
      `<polygon points="70,92 230,92 230,100 70,126" fill="none"/>` +
      `<polygon points="70,114 150,114 150,114" fill="none"/>` +
      `<polygon points="70,124 230,124 230,96" fill="rgba(239,68,68,.2)" stroke="${C.rd}" stroke-width="1.3" class="fd" style="animation-delay:.7s"/>` + tx(150, 142, 'γv·Msc·c / J  (added on one side, subtracted on the other)', { c: C.rd, w: 700, s: 8 }) +
      arr(150, 64, 150, 90, C.wh, 1, 4, 'dr', 1.2));
  }
  function figLinks() {     // shear reinforcement: stirrup lines
    let s = rect(20, 52, 260, 28, C.con, C.conD) + rect(125, 80, 50, 60, C.conD);
    [0, 1, 2].forEach(k => [-1, 1].forEach(sd => { const x = 150 + sd * (35 + k * 26); s += `<path d="M${x} 56V76" stroke="${C.am}" stroke-width="2.4" class="fd" style="animation-delay:${.3 + k * .3}s"/>`; }));
    s += dim(175, 98, 189, 98, C.cy) + tx(182, 110, '≤ 0.5d', { c: C.cy, s: 7.5, w: 700 }) + dim(189, 98, 215, 98, C.cy) + tx(215, 110, '0.5d', { c: C.cy, s: 7.5, w: 700 });
    s += tx(150, 40, 'stirrups / studs in perimeters around the column', { c: C.am, w: 700, s: 9 }) + `<path d="M62 38L238 38" stroke="${C.rd}" stroke-width="1.4" stroke-dasharray="3 3"/>` + tx(150, 30, 'outer perimeter must carry vc alone', { s: 8 });
    return svg('0 0 300 140', s);
  }
  function figTors() {     // torsional member: the slab strip twists where it meets the column
    return svg('0 0 300 130', rect(40, 54, 220, 18, C.con, C.conD) + rect(135, 72, 30, 46, C.conD) + `<path d="M118 63Q150 40 182 63" fill="none" stroke="${C.am}" stroke-width="2" class="dr" pathLength="1"/>` + arr(182, 63, 190, 70, C.am, 2, 6) +
      tx(150, 30, 'slab strip twists next to the column', { c: C.am, w: 700, s: 9 }) + dim(110, 96, 190, 96, C.cy) + tx(150, 108, 'torsional member: width = column c2', { c: C.cy, s: 8.5, w: 700 }) + `<path d="M40 63H118M182 63H260" stroke="${C.gr}" stroke-width="3" class="fd"/>` + tx(70, 50, 'slab-beam', { c: C.gr, s: 8, w: 700 }));
  }
  function figUnb() {      // unbalanced moment
    return svg('0 0 300 140', `<path d="M30 70H270" stroke="${C.mu}" stroke-width="1"/>` + `<path d="M30 70Q80 25 150 70" fill="rgba(239,68,68,.15)" stroke="${C.rd}" stroke-width="1.6" class="dr" pathLength="1"/>` + `<path d="M150 70Q215 105 270 70" fill="rgba(239,68,68,.15)" stroke="${C.rd}" stroke-width="1.6" class="dr" pathLength="1" style="animation-delay:.4s"/>` +
      rect(143, 70, 14, 50, C.conD) + tx(112, 40, 'M left', { c: C.rd, s: 9, w: 700 }) + tx(200, 98, 'M right', { c: C.rd, s: 9, w: 700 }) + arr(150, 130, 150, 100, C.am, 1.6, 5, 'fd', 1) + tx(150, 136, 'Munb = M left − M right → column and punching shear', { c: C.am, s: 8.5, w: 700 }));
  }
  function figFlow() {     // design flow
    const box = (x, y, t, col, dl) => `<g class="fd" style="animation-delay:${dl}s"><rect x="${x}" y="${y}" width="86" height="26" rx="6" fill="rgba(255,255,255,.04)" stroke="${col}" stroke-width="1.3"/>${tx(x + 43, y + 16, t, { c: C.wh, s: 8, w: 600 })}</g>`;
    return svg('0 0 300 130', box(10, 10, 'reaction VEd', C.cy, .1) + box(107, 10, 'moment MEd', C.cy, .3) + box(204, 10, 'perimeter u1 / b0', C.gr, .5) + box(10, 52, 'stress vEd / vu', C.gr, .7) + box(107, 52, 'capacity', C.gr, .9) + box(204, 52, 'OK ?', C.am, 1.1) + box(107, 94, 'links / studs', C.rd, 1.3) + box(204, 94, 'outer perimeter', C.rd, 1.5) + ln(96, 23, 107, 23, C.mu, 1) + ln(193, 23, 204, 23, C.mu, 1) + ln(247, 36, 247, 52, C.mu, 1) + ln(204, 65, 193, 65, C.mu, 1) + ln(107, 65, 96, 65, C.mu, 1) + ln(204, 107, 193, 107, C.mu, 1) + ln(150, 78, 150, 94, C.mu, 1));
  }
  const udl = null;

  /* ------------------------------------------------------------ topics */
  const ICONS = { efm: '<path d="M4 8h16M4 8v12M12 8v12M20 8v12M4 4h16"/>', pun: '<path d="M3 9h18M9 9v12M15 9v12M6 14l3-5M18 14l-3-5"/>' };
  const T1 = { id: 'efm', name: 'Equivalent Frame', sub: 'EFM analysis of flat slabs', icon: ICONS.efm, lessons: [] };
  const T2 = { id: 'punching', name: 'Punching Shear', sub: 'Slab–column connections', icon: ICONS.pun, lessons: [] };

  /* ============================================================ 7 · EQUIVALENT FRAME – CONCEPT */
  T1.lessons.push({ id: 'efm-concept', kind: 'Concept', title: 'Turning a flat slab into a plane frame', build: () => {
    const e = EX1(), K = e.RE.K[1];
    return [
      TITLE(T1, 'Concept', 'Equivalent Frame', 'Turning a flat slab into a plane frame'),
      SD('THE PROBLEM', 'A slab with no beams', UL(['A flat slab rests directly on columns: <b>no beams</b> carry the load to the supports.', 'Exact analysis needs a 3-D plate model (finite elements).', 'The <b>Equivalent Frame Method (EFM)</b> replaces it with a <b>2-D frame</b> you can solve by hand or with a small program — allowed by <b>EC2 Annex I.1</b> and <b>ACI 318 §8.11</b>.'])),
      SD('STEP 1 · SLICE THE BUILDING', 'Frames in each direction', FIG(figPlan(), 'Cut the structure along column lines. Each frame has the <b>width l2</b> measured between the centre-lines of the panels on either side. Repeat in the other direction.')),
      SD('STEP 2 · BUILD THE MODEL', 'Members of the frame', FIG(figFrame(), 'Three kinds of member: <b>slab-beams</b> (width l2, depth h), <b>columns</b> above and below the floor, and <b>torsional members</b> that connect them.') + CALL('Slab-beams run <b>centre-to-centre of the columns</b>. In SlabLab they are prismatic: constant l2 × h.')),
      SD('STEP 3 · STIFFNESS', 'How stiff is each member?', EQ('Slab-beam', 'K = 4·E·I / L', `I = l2·h³/12 → span 1: <b>${g(e.Ks, 4)}</b> (E = 1)`) + EQ('Column, far end fixed', 'Kc = 4·E·I / H', 'pinned far end: 3·E·I / H') + EQ('Torsional member (ACI)', 'Kt = Σ 9·E·C / [l2·(1 − c2/l2)³]', 'C = Σ (1 − 0.63x/y)·x³y/3') + EQ('Equivalent column', '1 / Kec = 1 / ΣKc + 1 / Kt', `ΣKc counts the column above and below. SlabLab shows <b>kec/kc</b> in the column table (here ${g(K.k / K.kc, 3)})`, 1)),
      SD('STEP 4 · LOADS', 'Which spans are loaded?', FIG(figPatterns(), 'Live load can sit anywhere, so we check patterns. <b>EC2</b>: A all spans, B interior spans, C end spans (dead load elsewhere). <b>ACI 6.4.3</b>: if L ≤ 0.75D load every span; otherwise <b>75 % of L</b> in checkerboard / adjacent-span patterns.') + CALL('The design value at each section is the <b>envelope</b> (max / min) over all cases.')),
      SD('STEP 5 · SOLVE', 'Joint rotations', UL(['Every joint can rotate (and the columns can shorten axially).', 'Fixed-end moments for a span: <b>w·L²/12</b>.', 'Stiffness method: <b>K · θ = −FEM</b> → rotations → end moments → shears and column reactions.', 'Global check: loads = reactions + column moments (equilibrium residual ≈ 0).'])),
      SD('STEP 6 · FRAME → STRIPS', 'Column strip and middle strip', FIG(figStrips(), 'The frame moment acts across the whole width l2 but is <b>not uniform</b>: it concentrates near the columns.') + EQ('EC2 Annex I.1.2', 'hogging 60–80 % · sagging 50–70 %', 'to the column strip') + EQ('ACI 8.10.5 (flat plate)', 'neg. interior 75 % · neg. exterior 100 % · pos. 60 %', '')),
      SD('STEP 7 · DESIGN VALUES', 'Where do we design?', UL(['<b>EC2</b>: hogging moments at the column centre-line may be reduced to the face (SlabLab keeps the centre-line value, which is conservative).', '<b>ACI 8.4.2.1 / 8.11.6.1</b>: negative moment at the <b>face of the support</b>, but not further than <b>0.175·l1</b> from the column centre.', 'The <b>unbalanced moment</b> at each column (Kec·θ) is not for bending design — it goes to the <b>punching shear</b> check.'])),
      SD('WHY NOT THE DIRECT DESIGN METHOD?', 'EFM vs DDM', UL(['The <b>Direct Design Method</b> (ACI 8.10) uses fixed coefficients but needs <b>≥ 3 spans</b>, similar spans, regular columns and L ≤ 2D.', 'The <b>EFM</b> has no such limits: different spans, loads, column sizes and heights are all handled by the same stiffness model.', 'EC2 Annex I.1 only describes the frame idea — the stiffness solution is yours: that is exactly what SlabLab does.'])),
      SD('THE TORSIONAL MEMBER', 'Why the column looks softer', FIG(figTors(), 'Where the slab meets the column it must <b>twist</b>. This extra flexibility lowers the rotational stiffness the column offers to the slab.') + EQ('Equivalent column', '1/Kec = 1/ΣKc + 1/Kt', 'a soft Kt can reduce kec/kc a lot — SlabLab lets you include or ignore it', 1)),
      SD('UNBALANCED MOMENT', 'What the column really receives', FIG(figUnb(), 'At an interior joint the two slab moments differ. The difference must be carried by the column — and by the slab–column connection in <b>punching shear</b>.')),
      SD('READING THE DIAGRAMS', 'Conventions in SlabLab', UL(['<b>Hogging</b> moments (tension on top) are <b>negative</b>; sagging positive and drawn downward.', 'The envelope is the outline of all load cases; the numbers are the maxima.', 'Column moments are drawn beside each column: joint value and far-end value; the column shear is (Mj + Mfar)/H.', '<b>N</b> under each column is the maximum axial load = the punching shear force.'])),
      SD('STATIC CHECK', 'A quick sanity test', EQ('Every span', 'M⁺ + (M⁻L + M⁻R)/2 ≥ w·L²/8', 'the average of the end moments plus the span moment cannot be smaller than the simply-supported moment', 1) + CALL('If a span fails this check the frame has an error (wrong load, wrong span, missing column). The worked example does it with real numbers.', 'am')),
      SD('REMEMBER', 'Common mistakes', CHIPS([['Wrong strip width l2', 'no'], ['Forgetting torsional flexibility', 'am'], ['Using centre-line moments for ACI', 'am'], ['Ignoring pattern loading', 'no'], ['Column H = 0 means no column', 'cy']]) + CALL('Always check the <b>equilibrium residual</b> and the sign of the support moments before trusting the frame.', 'am'))
    ]; } });

  /* ============================================================ 7 · EQUIVALENT FRAME – WORKED EXAMPLE */
  T1.lessons.push({ id: 'efm-example', kind: 'Worked example', title: 'Frame RC_project: 3 spans, 5 · 4 · 5 m', build: () => {
    const e = EX1(), R = e.RE, RA = e.RA, v = R.gov, va = RA.gov, K0 = R.K[0], K1 = R.K[1], rw = R.rows, S = e.S, wuE = rw[0].wu, wuA = RA.rows[0].wu, DA = e.DA;
    return [
      TITLE(T1, 'Worked example', 'Equivalent Frame', 'Frame RC_project: 3 spans, 5 · 4 · 5 m'),
      SD('THE FRAME', 'Data', KV([['Spans L', '5 · 4 · 5 m'], ['Strip l2', '4 m'], ['Slab h', '170 mm'], ['Columns c1 × c2', '400 × 250 mm'], ['Heights H', '4.5 m above / below'], ['Loads gk · qk', '6.25 · 5.0 kN/m²']]) + FIG(figFrame(), 'Edge columns A and D, interior columns B and C.')),
      SD('STEP 1', 'Slab-beam and column stiffness', EQ('Slab-beam span 1', 'Kslab = 4·E·(l2·h³/12)/L', `= 4·(4·0.17³/12)/5 = <b>${g(e.Ks, 5)}</b>`) + EQ('Column I', 'I = c2·c1³/12', `= 0.25·0.4³/12 = <b>${g(e.I, 6)} m⁴</b>`) + EQ('Column stiffness (above + below)', 'Kc = 2·4·E·I/H', `= <b>${g(e.Kc, 5)}</b>`) + EQ('Interior column B (solver)', 'kc / k', `= ${g(K1.kc, 5)} / ${g(K1.k, 5)} (kec/kc = ${g(K1.k / K1.kc, 3)})`, 1)),
      SD('STEP 2 · EC2', 'Loads on the frame strip', EQ('ULS', 'wu = (1.35·6.25 + 1.5·5)·4', `= <b>${g(wuE, 2)} kN/m</b>`) + EQ('Patterns', 'A · B · C', 'all spans · interior only · end spans only (dead 1.35·gk·l2 = ' + g(rw[0].wd, 2) + ' kN/m elsewhere)') + CALL('The envelope of the three cases gives max/min M and V at every section.')),
      SD('STEP 3 · EC2', 'Envelope results', MT([['M⁺ max', g(v.Mp, 1), 'kNm'], ['M⁻ max (col.)', g(v.Mh, 1), 'kNm'], ['V max', g(v.V, 1), 'kN']]) + KV(rw.map((r, i) => [`Span ${i + 1}`, `M⁻ ${g(r.ML, 1)} · M⁺ ${g(r.Mp, 1)} · M⁻ ${g(r.MR, 1)}`])) + CALL(`Equilibrium residual <b>${R.res.toExponential(1)}</b> kNm ✓`, 'ok')),
      SD('THE WHOLE FRAME', 'Moments, shears and columns', FIG(FL.diagrams(R), 'Slab moments (red), shear forces (yellow) and column end moments, shears and axial loads — the new full-frame diagrams of SlabLab.')),
      SD('STEP 4 · ACI', 'Same frame, ACI loads', EQ('Factored load', 'U = 1.2D + 1.6L', `wu = (1.2·6.25 + 1.6·5)·4 = <b>${g(wuA, 2)} kN/m</b>`) + EQ('Pattern rule 6.4.3', 'L = 5 ≤ 0.75D = 4.69 ?', RA.cases.length > 1 ? `<b>no</b> → 75 % L patterns, ${RA.cases.length} cases` : 'yes → L on all panels') + MT([['M⁺ max', g(va.Mp, 1), 'kNm'], ['M⁻ face', g(va.Mhf, 1), 'kNm'], ['V max', g(va.V, 1), 'kN']])),
      SD('STEP 5', 'Column strip and middle strip', EQ('EC2 (70 % / 60 %)', 'M⁻col = 0.70·M⁻ · M⁺col = 0.60·M⁺', `span 1: ${g(0.7 * rw[0].ML, 1)} · ${g(0.6 * rw[0].Mp, 1)} kNm → per metre of strip ${g(0.7 * rw[0].ML / (0.5 * Math.min(5, 4)), 1)} · ${g(0.6 * rw[0].Mp / (0.5 * Math.min(5, 4)), 1)} kNm/m`) + EQ('Strip width', 'bcs = 0.5·min(L, l2)', '= 0.5·4 = 2.0 m (span 1)') + CALL('Each strip is then designed as a normal slab strip: As, spacing, crack control.')),
      SD('SANITY CHECK', 'Statics of every span', KV(rw.map((r, i) => { const L = S.L[i], mo = r.wu * L * L / 8, ms = r.Mp - (r.ML + r.MR) / 2; return ['Span ' + (i + 1), 'wL²/8 = ' + g(mo, 1) + ' · M⁺ + avg M⁻ = ' + g(ms, 1) + ' ' + (ms >= mo * 0.995 ? '✓' : '✗')]; })) + CALL('The span moment envelope always covers the static moment (envelopes can exceed it because they combine cases).')),
      SD('COLUMNS', 'Reactions and moments', KV(R.cols.map((cl, j) => ['Column ' + 'ABCD'[j], 'N = ' + g(cl.N, 1) + ' kN · Munb = ' + g(cl.M, 1) + ' kNm (above ' + g(cl.Ma, 1) + ' / below ' + g(cl.Mb, 1) + ')'])) + CALL('The edge columns A and D carry the largest <b>moment</b>; the interior columns B and C carry the largest <b>axial load</b>.')),
      SD('FACE OF SUPPORT', 'Centre-line vs face moment (ACI)', EQ('Support B, span 2 left', 'M at the column face', `centre-line ${g(RA.rows[1].ML, 1)} → face (x = 0.2 m) <b>${g(RA.rows[1].MLf, 1)} kNm</b>`) + EQ('Governing hogging', 'ACI face value vs EC2 centre-line', `${g(va.Mhf, 1)} vs ${g(v.Mh, 1)} kNm`, 1) + CALL('The face reduction is a feature of the code, not a free lunch: it assumes the column is stiff and the support width is real.')),
      SD('WHAT IF…', 'Include the torsional member', (() => { const S2 = JSON.parse(JSON.stringify(S)), R2 = FL.efm(S2, { gG: 1.35, gQ: 1.5, sG: 1, sQ: 0.3, fx: 4, tor: 1, ax: 1 }); return EQ('Ignoring torsion', 'kec/kc = 1', `column B moment <b>${g(R.cols[1].M, 1)} kNm</b>`) + EQ('Including torsion', 'kec/kc = ' + g(R2.K[1].k / R2.K[1].kc, 3), `column B moment <b>${g(R2.cols[1].M, 1)} kNm</b> · M⁺ max ${g(R2.gov.Mp, 1)} kNm`, 1) + CALL('Softer columns move moment from the supports into the spans: check both models when the answer is close.'); })()),
      SD('RESULT', 'What SlabLab designs', CHIPS([['EC2 ' + e.D.st.overall, e.D.st.overall === 'OK' ? 'ok' : 'no'], ['ACI ' + DA.st.overall, DA.st.overall === 'OK' ? 'ok' : 'no']]) + KV([['EC2 span 1 CS bottom', e.D.spans[0].cs.S.txt], ['ACI span 1 CS bottom', DA.spans[0].cs.S.txt], ['EC2 col. B moment', g(R.cols[1].M, 1) + ' kNm'], ['ACI col. B moment', g(RA.cols[1].M, 1) + ' kNm']]) + CALL('The column moments feed the <b>punching shear</b> lessons next.'))
    ]; } });

  /* ============================================================ 8 · PUNCHING – CONCEPT */
  T2.lessons.push({ id: 'punching-concept', kind: 'Concept', title: 'How a flat slab fails around a column', build: () => [
    TITLE(T2, 'Concept', 'Punching Shear', 'How a flat slab fails around a column'),
    SD('THE IDEA', 'Shear without beams', UL(['At a column the whole floor reaction is pushed through a <b>small area</b> of slab.', 'The column tries to <b>punch through</b> the slab, pulling a cone of concrete with it.', 'The failure is <b>brittle</b> — no warning — and can spread to neighbouring columns (progressive collapse). It often governs the thickness of a flat slab.'])),
    SD('THE CONE', 'Failure mechanism', FIG(figCone(), 'Inclined cracks (35–45°) open around the column. Resistance comes from concrete in tension/shear along the perimeter and from dowel action of the top bars.')),
    SD('CRITICAL PERIMETER', 'Where do we check?', FIG(figPerim(), 'Both codes check shear stress on a perimeter around the column — at a different distance and with a different shape.') + EQ('EC2 6.4', 'u1 at 2d · u0 at the column face', 'also u_out where links end') + EQ('ACI 22.6.4', 'b0 at d/2 from the face', 'straight-sided (rectangle)', 1)),
    SD('EDGE AND CORNER COLUMNS', 'Fewer sides, more moment', FIG(figEdge(), 'At a free edge the perimeter is <b>3-sided</b> (edge column) or <b>2-sided</b> (corner). The slab edge cannot carry shear, so the same load acts on a shorter perimeter.')),
    SD('SHEAR STRESS', 'Load plus moment', FIG(figStress(), 'The column also transfers an <b>unbalanced moment</b> (from the frame). Part of it creates extra shear stress, high on one side of the column.') + EQ('EC2', 'vEd = β·VEd / (u1·d)', 'β = 1 + k·MEd·u1/(VEd·W1), or 1.15 / 1.4 / 1.5') + EQ('ACI 8.4.4', 'vu = Vu/(b0·d) + γv·Msc·c / Jc', 'γv = 1 − γf, γf = 1/(1 + ⅔√(b1/b2))', 1)),
    SD('CAPACITY', 'What can the concrete carry?', EQ('EC2 6.4.4', 'vRd,c = 0.18/γc · k · (100ρ·fck)^⅓ ≥ vmin', 'k = 1 + √(200/d) ≤ 2, ρ ≤ 2 %') + EQ('ACI 22.6.5.2', 'vc = min[0.33 ; 0.17 + 0.33/β ; 0.17 + 0.083αs·d/b0]·λs·√f′c', 'φ = 0.75, λs = √(2/(1 + d/250)) ≤ 1 · αs = 40 / 30 / 20') + CALL('Thick slabs, strong concrete and <b>more top steel</b> (EC2: ρ) all increase capacity. Larger columns increase the perimeter.')),
    SD('NOT ENOUGH?', 'Your options', UL(['<b>Increase h</b> (most effective: d enters twice).', '<b>Bigger column</b>, <b>column capital</b> or <b>drop panel</b>.', '<b>Shear reinforcement</b>: links / studs in perimeters (EC2 6.4.5, ACI 22.6.6 – 22.6.8).', 'Upper limit: EC2 vEd ≤ 1.5·vRd,c (u1) and vEd ≤ vRd,max (u0) · ACI vu ≤ φ·0.5√f′c for stirrups.'])),
    SD('SHEAR REINFORCEMENT', 'Layout around the column', FIG(figLinks(), 'First line at about <b>0.3–0.5d</b> from the column, spacing ≤ <b>0.5d</b> (ACI) / 0.75d (EC2). Continue until the <b>outer perimeter</b> can be carried by the concrete alone.')),
    SD('SIZE EFFECT', 'Thick slabs are relatively weaker', EQ('EC2', 'k = 1 + √(200/d) ≤ 2.0', 'd in mm: capacity per unit area falls as d grows') + EQ('ACI', 'λs = √(2 / (1 + d/250)) ≤ 1', 'd in mm: reduces vc for d > 250 mm') + CALL('Both codes encode the same physics: shear strength does not grow in proportion to depth.')),
    SD('TOP STEEL', 'Reinforcement helps in EC2, protects in ACI', UL(['<b>EC2</b>: vRd,c uses ρl = √(ρly·ρlz) of the <b>top</b> bars in a width c + 3d each side of the column: more steel → more capacity.', '<b>ACI</b>: capacity does not use ρ, but 8.6.1.2 asks for extra top steel when vuv is high, and 8.7.4.2 requires bottom bars through the column to prevent progressive collapse.', 'Concentrate bars over the column; do not smear them across the strip.'])),
    SD('MOMENT TRANSFER', 'Flexure and shear share the moment', EQ('ACI 8.4.2.3', 'γf = 1/(1 + ⅔√(b1/b2))', '≈ 60 % by flexure, 40 % (γv) by shear for a square column') + EQ('Width for flexure', 'bslab = c2 + 3h', 'put the extra top bars inside this width') + EQ('EC2', 'β factor', 'one number multiplies V: 1.15 interior, 1.4 edge, 1.5 corner when no detailed calculation is made')),
    SD('FREE EDGES', 'Why edge columns are critical', UL(['A shorter perimeter carries the same reaction, so stress is higher.', 'The unbalanced moment is largest at edge columns (little restraint from one side).', 'EC2: β = 1.4 (edge), 1.5 (corner) — or the exact β with W1 for interior columns.', 'ACI: the section centroid is not at the column centre, so Vu·g is subtracted from Msc (R8.4.4.2.3).'])),
    SD('THE WORKFLOW', 'From frame to punching check', FIG(figFlow(), 'The same chain in both codes: reaction and moment from the equivalent frame → perimeter → stress → capacity → reinforcement → outer perimeter.')),
    SD('REMEMBER', 'Checklist', CHIPS([['Use the column reaction VEd', 'cy'], ['Add the unbalanced moment', 'am'], ['Edge / corner perimeter', 'am'], ['Mean d of both layers', 'cy'], ['Outer perimeter', 'no']]) + CALL('Always ask: <b>is the governing column the interior one (largest V) or the edge one (largest moment)?</b>', 'am'))
  ] });

  /* ============================================================ 8 · PUNCHING – WORKED EXAMPLE */
  T2.lessons.push({ id: 'punching-example', kind: 'Worked example', title: 'Interior column B: EC2 and ACI side by side', build: () => {
    const e = EX2(), pe = e.pe, pa = e.pa, cs = pa.cs, c = e.c;
    return [
      TITLE(T2, 'Worked example', 'Punching Shear', 'Interior column B: EC2 and ACI side by side'),
      SD('THE CONNECTION', 'Data', KV([['Frame', '4 spans 6 · 7.5 · 7.5 · 6 m, l2 = 5 m'], ['Slab', 'h = 220 mm · fck = ' + c.fck + ' MPa · fyk = ' + c.fyk + ' MPa'], ['Column B', '350 × 350 mm, interior'], ['Loads', 'gk = 7.0 · qk = 3.0 kN/m²'], ['Effective depth', 'd = ' + f0(pe.dp) + ' mm (mean of two layers)'], ['Top steel over B', 'column strip ' + e.D.spans[1].cs.L.txt]]) + CALL('Reactions and unbalanced moments come from the equivalent-frame solution.')),
      SD('EC2 · STEP 1', 'Control perimeters', EQ('Column perimeter', 'u0 = 2(c1 + c2)', `= <b>${f0(pe.u0)} mm</b>`) + EQ('Basic perimeter at 2d', 'u1 = u0 + 4π·d', `= ${f0(pe.u0)} + 4π·${f0(pe.dp)} = <b>${f0(pe.u1)} mm</b>`, 1) + EQ('Design actions', 'VEd · MEd', `<b>${f0(pe.VEd)} kN</b> · <b>${f1(pe.MEd)} kNm</b>`)),
      SD('EC2 · STEP 2', 'Moment factor β', EQ('k (c1/c2 = 1)', 'Table 6.1', `= <b>${g(pe.kk, 2)}</b>`) + EQ('W1', 'c1²/2 + c1c2 + 4c2d + 16d² + 2πd·c1', `= <b>${f0(pe.W1)} mm²</b>`) + EQ('β', '1 + k·MEd·u1 / (VEd·W1)', `= <b>${g(pe.beta, 3)}</b>`, 1)),
      SD('EC2 · STEP 3', 'Stress and capacity', EQ('Applied', 'vEd = β·VEd / (u1·d)', `= <b>${f2(pe.v1)} N/mm²</b>`) + EQ('Concrete', 'vRd,c = 0.18/γc·k·(100ρ·fck)^⅓', `k = ${g(pe.k, 3)} · ρl = ${g(pe.rho * 100, 2)} % → <b>${f2(pe.vrdc)} N/mm²</b>`) + CHIPS([[pe.v1 <= pe.vrdc ? 'vEd ≤ vRd,c ✓' : 'vEd > vRd,c → links', pe.v1 <= pe.vrdc ? 'ok' : 'am'], ['vEd ≤ 1.5·vRd,c ' + (pe.v1 <= 1.5 * pe.vrdc ? '✓' : '✗'), pe.v1 <= 1.5 * pe.vrdc ? 'ok' : 'no']])),
      SD('EC2 · STEP 4', 'Links', pe.links ? EQ('Required area per perimeter', 'Asw = (vEd − 0.75·vRd,c)·sr·u1 / (1.5·fywd,ef)', `= <b>${f0(pe.links.Areq)} mm²</b> (Asw,min ${f0(pe.links.Amin)}) → provided ${f0(pe.links.Asw)} mm²`) + EQ('Layout', `Ø${c.phiL} · sr ≤ 0.75d`, `<b>${pe.links.legs} legs × ${pe.links.nP} perimeters</b> at sr = ${f0(pe.links.sr)} mm`, 1) + CALL('Outer perimeter u_out must satisfy vEd ≤ vRd,c with the last link line at ≤ 1.5d from it.') : CALL('No links needed ✓', 'ok')),
      SD('ACI · STEP 1', 'Critical section at d/2', EQ('Sides', 'b1 = b2 = c + d', `= ${f0(cs.a)} mm`) + EQ('Perimeter', 'b0 = 2(b1 + b2)', `= <b>${f0(cs.b0)} mm</b>`) + EQ('Net shear', 'Vu = R − wu·b1·b2', `= ${f0(pa.Vcol)} − ${f1(pa.Uarea)}·${f2(cs.area / 1e6)} = <b>${f0(pa.Vu)} kN</b>`) + EQ('Moment fraction', 'γf = 1/(1 + ⅔√(b1/b2))', `γf = ${g(pa.gf, 3)} · γv = <b>${g(pa.gv, 3)}</b>`)),
      SD('ACI · STEP 2', 'Stress', EQ('Section property', 'Jc = d·b1³/6 + b1·d³/6 + d·b2·b1²/2', `= <b>${(cs.J / 1e9).toFixed(2)} × 10⁹ mm⁴</b>`) + EQ('Gravity part', 'vuv = Vu / (b0·d)', `= <b>${f2(pa.vuv)} MPa</b>`) + EQ('Maximum', 'vu = vuv + γv·Msc·c / Jc', `Msc = ${f1(pa.Msc)} kNm → <b>${f2(pa.vu)} MPa</b>`, 1)),
      SD('ACI · STEP 3', 'Capacity', EQ('vc = min of three', `0.33 · ${f2(0.17 + 0.33 / pa.beta)} · ${f2(0.17 + 0.083 * pa.as * pa.d / cs.b0)} (×λs·√f′c)`, `λs = ${g(pa.ls, 3)} → vc = <b>${f2(pa.vc)} MPa</b>`) + EQ('Design strength', 'φ·vc, φ = 0.75', `= <b>${f2(pa.phiVc)} MPa</b>`, 1) + CHIPS([[pa.vu <= pa.phiVc ? 'vu ≤ φvc ✓' : 'vu > φvc → stirrups', pa.vu <= pa.phiVc ? 'ok' : 'am']])),
      SD('ACI · STEP 4', 'Stirrups and moment transfer', (pa.links ? EQ('Stirrups', 'vs = vu/φ − 0.17√f′c ; Av = vs·b0·s / fyt', `Av = <b>${f0(pa.links.Av)} mm²</b> per line, s = ${pa.links.s} mm`) + EQ('Layout', `Ø${c.phiL} · first line d/2`, `<b>${pa.links.legs} legs × ${pa.links.lines} lines</b>`, 1) : CALL('No stirrups needed ✓', 'ok')) + EQ('Flexure transfers γf·Msc', 'within bslab = c2 + 3h', `${f1(pa.mt.Mf)} kNm → ${pa.mt.add ? '<b>+' + pa.mt.add + ' top bars</b>' : 'existing bars suffice'}`)),
      SD('EDGE COLUMN A', 'The other critical column', (() => { const a = e.D.punch[0], b = e.DA.punch[0]; return EQ('EC2 · 3-sided perimeter', 'u1 = c2 + 2c1 + 2πd, β = 1.4', `u1 = <b>${f0(a.u1)} mm</b> · vEd = <b>${f2(a.v1)}</b> vs vRd,c ${f2(a.vrdc)} MPa`) + EQ('ACI · U-shaped section', 'b0 = 2b1 + b2, Jc about its centroid', `b0 = <b>${f0(b.cs.b0)} mm</b> · g = ${f0(b.cs.g)} mm`) + EQ('ACI stress', 'vu = vuv + γv·(Msc − Vu·g)·c/Jc', `Msc = ${f1(b.Msc)} → net ${f1(b.Mc)} kNm · vu = <b>${f2(b.vu)}</b> vs φvc ${f2(b.phiVc)} MPa`, 1) + CHIPS([['EC2 ' + (a.links ? 'links' : 'OK'), a.links ? 'am' : 'ok'], ['ACI ' + (b.links ? 'stirrups' : 'OK'), b.links ? 'am' : 'ok']]); })()),
      SD('WHAT IF…', 'Thicker slab, h = 240 mm', (() => { const S2 = JSON.parse(JSON.stringify(e.S)); S2.h = S2.h.map(() => 240); const R2 = FL.efm(S2, { gG: 1.35, gQ: 1.5, sG: 1, sQ: 0.3, fx: 4, tor: 1, ax: 1 }), D2 = FL.design(R2, e.c, { basis: 'span', layer: 'outer', phi: 12, sn: 70, sp: 60 }), A2 = FL.efm(S2, { gG: 1.2, gQ: 1.6, sG: 1, sQ: 0.3, fx: 4, tor: 1, ax: 1, pat: 'aci' }), DA2 = AC.flat(A2, e.c, { basis: 'span', layer: 'outer', phi: 12, aciStrip: 'aci' }), a = D2.punch[1], b = DA2.punch[1]; return EQ('EC2, column B', 'h = 220 → 240 mm', `vEd/vRd,c = ${f2(pe.v1)}/${f2(pe.vrdc)} → <b>${f2(a.v1)}/${f2(a.vrdc)}</b> ${a.links ? '(links still needed)' : '(no links)'}`) + EQ('ACI, column B', 'h = 220 → 240 mm', `vu/φvc = ${f2(pa.vu)}/${f2(pa.phiVc)} → <b>${f2(b.vu)}/${f2(b.phiVc)}</b> ${b.links ? '(stirrups still needed)' : '(no stirrups)'}`, 1) + CALL('20 mm more thickness can remove all punching reinforcement: always compare the cost of concrete with the cost of links.'); })()),
      SD('COMPARE', 'Same column, two codes', MT([['EC2 vEd / vRd,c', f2(pe.v1) + ' / ' + f2(pe.vrdc), 'MPa'], ['ACI vu / φvc', f2(pa.vu) + ' / ' + f2(pa.phiVc), 'MPa'], ['Perimeters', f0(pe.u1) + ' / ' + f0(cs.b0), 'mm']]) + CALL('The codes use <b>different perimeters, loads and safety factors</b>, so compare outcomes, not intermediate numbers. SlabLab runs both from the same frame: tap <b>Run Design by EC2</b> or <b>ACI 318-25</b> after the analysis.'))
    ]; } });

  const have = LN.topics.some(t => t.id === 'efm');
  if (!have) { LN.topics.push(T1, T2); }
})(typeof window !== 'undefined' ? window : globalThis);
