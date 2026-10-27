/* SlabLab · Stage 50 · Offline PDF project report
   No external library: a small PDF writer (vector drawing, Helvetica + Symbol standard fonts), an SVG-to-PDF converter for the
   drawings the app already produces (strip / frame diagrams, detailing), and the report layout.
   Public API (window.SL_REPORT):
     build(recs, {title, cons})  -> Uint8Array   (recs = saved slab records: {kind, code, id, inp, cons})
     compute(rec, fallbackCons)  -> recomputed slab (EC2 result, ACI result, steps)
     save(bytes, filename)       -> triggers a download (works offline)
     share(bytes, filename, title) -> Promise<'shared'|'downloaded'|'cancelled'>  (Web Share API with a file, fallback = download)   */
(function (root) {
  'use strict';
  const L = () => ({ E: root.SL, E2: root.SL2, FL: root.SL_FLAT, AC: root.SL_ACID, ST: root.SL_STRIP });
  const PW = 595, PH = 842;
  const clone = o => JSON.parse(JSON.stringify(o));

  /* ================================================================ 1 · PDF core ================================================================ */
  const HELV = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
  const BOLD = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
  const EXTRA = { 0xB7: 278, 0xB2: 333, 0xB3: 333, 0xD7: 584, 0xD8: 778, 0xB0: 400, 0xB1: 584, 0xBD: 834, 0x95: 350, 0xB5: 556 };
  /* Greek letters and maths signs come from the standard Symbol font (letters share the Latin code of their Symbol glyph) */
  const SYM = { 'α':'a','β':'b','γ':'g','δ':'d','ε':'e','ζ':'z','η':'h','θ':'q','ι':'i','κ':'k','λ':'l','μ':'m','ν':'n','ξ':'x','π':'p','ρ':'r','σ':'s','τ':'t','υ':'u','φ':'f','χ':'c','ψ':'y','ω':'w',
    'Δ':'D','Σ':'S','Φ':'F','Ω':'W','Γ':'G','Θ':'Q','Λ':'L','Π':'P','Ψ':'Y','≤':'\xA3','≥':'\xB3','→':'\xAE','←':'\xAC','√':'\xD6','≈':'\xBB','∈':'\xCE','≠':'\xB9','∞':'\xA5' };
  const SUB = { 'ℓ':'l','′':"'",'’':"'",'‘':"'",'“':'"','”':'"','−':'-','–':'-','—':'-','‐':'-','…':'...','⁺':'+','⁻':'-','⁴':'^4','⁶':'^6','⅓':'1/3','●':'\x95','\u00A0':' ','✓':'OK','✗':'X','✅':'OK','❗':'!','⁄':'/','≤':'<=' };
  /* split a string into font runs: [{f:'F1'|'F3', t}] */
  function runs(s) {
    const out = []; let cur = null;
    const push = (f, t) => { if (cur && cur.f === f) cur.t += t; else { cur = { f, t }; out.push(cur); } };
    for (const ch of String(s)) {
      if (SYM[ch] !== undefined) { push('F3', SYM[ch]); continue; }
      let c = SUB[ch] !== undefined ? SUB[ch] : ch;
      for (const q of c) { const k = q.charCodeAt(0); push('F1', (k >= 32 && k <= 255) ? q : (k < 32 ? ' ' : '?')); }
    }
    return out;
  }
  function wOf(ch, bold) { const k = ch.charCodeAt(0); if (k >= 32 && k <= 126) return (bold ? BOLD : HELV)[k - 32]; return EXTRA[k] || 556; }
  function textW(s, size, bold) { let w = 0; runs(s).forEach(r => { if (r.f === 'F3') w += r.t.length * 600; else for (const ch of r.t) w += wOf(ch, bold); }); return w * size / 1000; }
  const pdfEsc = s => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const f2 = n => { const r = Math.round(n * 100) / 100; return (Object.is(r, -0) ? 0 : r).toString(); };
  function col(c) { c = String(c).replace('#', ''); if (c.length === 3) c = c.split('').map(x => x + x).join(''); return [0, 2, 4].map(i => (parseInt(c.substr(i, 2), 16) / 255).toFixed(3)).join(' '); }

  function Doc() {
    const pages = [], gs = {}; let cur = null;
    const al = a => { if (a == null || a >= 0.995) return ''; const k = Math.max(1, Math.round(a * 100)); gs[k] = 1; return '/G' + k + ' gs '; };
    const D = {
      page() { cur = []; pages.push(cur); return pages.length - 1; },
      use(i) { cur = pages[i]; }, count: () => pages.length, raw(s) { cur.push(s); },
      text(x, y, str, o) {
        o = o || {}; const size = o.size || 9, rs = runs(str), w = textW(str, size, o.bold);
        let X = x; if (o.align === 'c') X = x - w / 2; else if (o.align === 'r') X = x - w;
        let s = 'q ' + al(o.alpha) + col(o.color || '#0A0F0D') + ' rg BT ';
        rs.forEach(r => {
          const font = r.f === 'F3' ? 'F3' : (o.bold ? 'F2' : 'F1'), rw = r.f === 'F3' ? r.t.length * 600 * size / 1000 : textW(r.t, size, o.bold);
          s += '/' + font + ' ' + f2(size) + ' Tf 1 0 0 1 ' + f2(X) + ' ' + f2(PH - y) + ' Tm (' + pdfEsc(r.t) + ') Tj '; X += rw;
        });
        cur.push(s + 'ET Q');
      },
      shape(cmds, st) {
        const d = cmds.map(c => c[0] === 'M' ? f2(c[1]) + ' ' + f2(PH - c[2]) + ' m' : c[0] === 'L' ? f2(c[1]) + ' ' + f2(PH - c[2]) + ' l'
          : c[0] === 'C' ? f2(c[1]) + ' ' + f2(PH - c[2]) + ' ' + f2(c[3]) + ' ' + f2(PH - c[4]) + ' ' + f2(c[5]) + ' ' + f2(PH - c[6]) + ' c' : 'h').join(' ');
        if (st.fill) cur.push('q ' + al(st.fa) + col(st.fill) + ' rg ' + d + ' f Q');
        if (st.stroke) cur.push('q ' + al(st.sa) + f2(st.lw || 1) + ' w ' + col(st.stroke) + ' RG ' + (st.dash ? '[' + st.dash.map(f2).join(' ') + '] 0 d ' : '') + '1 J 1 j ' + d + ' S Q');
      },
      rect(x, y, w, h, st) { D.shape([['M', x, y], ['L', x + w, y], ['L', x + w, y + h], ['L', x, y + h], ['Z']], st); },
      rrect(x, y, w, h, r, st) {
        r = Math.min(r, w / 2, h / 2); const k = r * 0.5523;
        D.shape([['M', x + r, y], ['L', x + w - r, y], ['C', x + w - r + k, y, x + w, y + r - k, x + w, y + r], ['L', x + w, y + h - r], ['C', x + w, y + h - r + k, x + w - r + k, y + h, x + w - r, y + h],
          ['L', x + r, y + h], ['C', x + r - k, y + h, x, y + h - r + k, x, y + h - r], ['L', x, y + r], ['C', x, y + r - k, x + r - k, y, x + r, y], ['Z']], st);
      },
      circle(cx, cy, r, st) {
        const k = r * 0.5523;
        D.shape([['M', cx + r, cy], ['C', cx + r, cy + k, cx + k, cy + r, cx, cy + r], ['C', cx - k, cy + r, cx - r, cy + k, cx - r, cy], ['C', cx - r, cy - k, cx - k, cy - r, cx, cy - r], ['C', cx + k, cy - r, cx + r, cy - k, cx + r, cy], ['Z']], st);
      },
      line(x1, y1, x2, y2, st) { D.shape([['M', x1, y1], ['L', x2, y2]], { stroke: st.color || '#000000', lw: st.lw || 0.8, dash: st.dash, sa: st.alpha }); },
      build(info) {
        const n = pages.length, ids = [], ob = [];
        ob[1] = '<< /Type /Catalog /Pages 2 0 R >>';
        ob[2] = '<< /Type /Pages /Kids [' + pages.map((_, i) => (7 + 2 * i) + ' 0 R').join(' ') + '] /Count ' + n + ' >>';
        ob[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
        ob[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
        ob[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Symbol >>';
        ob[6] = '<< /Title (' + pdfEsc(String((info && info.title) || 'SlabLab report').replace(/[^\x20-\x7E]/g, '?')) + ') /Producer (SlabLab) /Creator (SlabLab) >>';
        const gstr = Object.keys(gs).map(k => '/G' + k + ' << /ca ' + (k / 100) + ' /CA ' + (k / 100) + ' >>').join(' ');
        pages.forEach((c, i) => {
          const s = c.join('\n');
          ob[7 + 2 * i] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PW + ' ' + PH + '] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> /ExtGState << ' + gstr + ' >> >> /Contents ' + (8 + 2 * i) + ' 0 R >>';
          ob[8 + 2 * i] = '<< /Length ' + s.length + ' >>\nstream\n' + s + '\nendstream';
        });
        const max = 6 + 2 * n; let out = '%PDF-1.4\n', off = [];
        for (let i = 1; i <= max; i++) { off[i] = out.length; out += i + ' 0 obj\n' + ob[i] + '\nendobj\n'; }
        const x = out.length;
        out += 'xref\n0 ' + (max + 1) + '\n0000000000 65535 f \n' + off.slice(1).map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') + 'trailer\n<< /Size ' + (max + 1) + ' /Root 1 0 R /Info 6 0 R >>\nstartxref\n' + x + '\n%%EOF';
        const u = new Uint8Array(out.length); for (let i = 0; i < out.length; i++) u[i] = out.charCodeAt(i) & 255; return u;
      }
    };
    return D;
  }

  /* ================================================================ 2 · SVG → PDF ================================================================ */
  /* print palette: the app drawings use theme variables, here they are resolved for white paper */
  const VARS = { '--mu': '#5E6E69', '--ln': '#DCE5E1', '--cd': '#F3F7F6', '--fg': '#0A0F0D', '--bg': '#FFFFFF', '--gr': '#12C26B', '--gr2': '#0C9A55', '--cy': '#1DD3F0', '--cy2': '#0DAFCB', '--rd': '#EF4444', '--am': '#F5A524' };
  const REMAP = { '#F5C518': '#D4A100', '#1DD3F0': '#12B5D0' };
  const NAMED = { gray: '#808080', grey: '#808080', white: '#FFFFFF', black: '#000000' };
  function paint(v) {
    if (v == null) return null; v = String(v).trim(); let m;
    if (!v || v === 'none' || v === 'transparent') return { c: null, a: 1 };
    if ((m = /^var\(\s*(--[\w-]+)/.exec(v))) return { c: VARS[m[1]] || '#000000', a: 1 };
    if ((m = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.]+))?\s*\)/.exec(v))) return { c: '#' + [m[1], m[2], m[3]].map(x => ('0' + Math.round(+x).toString(16)).slice(-2)).join('').toUpperCase(), a: m[4] == null ? 1 : +m[4] };
    if (v[0] === '#') { let h = v.toUpperCase(); if (h.length === 4) h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3]; return { c: REMAP[h] || h, a: 1 }; }
    if (v === 'currentColor') return { c: '#0A0F0D', a: 1 };
    if (NAMED[v]) return { c: NAMED[v], a: 1 };
    return { c: '#000000', a: 1 };
  }
  const ent = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&');
  function attrs(str) {
    const a = {}; str.replace(/([\w:-]+)\s*=\s*"([^"]*)"/g, (_, k, v) => { a[k] = v; });
    if (a.style) a.style.split(';').forEach(p => { const i = p.indexOf(':'); if (i > 0) a[p.slice(0, i).trim()] = p.slice(i + 1).trim(); });
    return a;
  }
  function pathCmds(d) {
    const t = d.match(/[a-zA-Z]|-?\d*\.?\d+/g) || []; let i = 0, x = 0, y = 0, sx = 0, sy = 0, cmd = '', out = []; const n = () => parseFloat(t[i++]);
    while (i < t.length) {
      if (/[a-zA-Z]/.test(t[i])) { cmd = t[i++]; if (cmd === 'Z' || cmd === 'z') { out.push(['Z']); x = sx; y = sy; continue; } }
      switch (cmd) {
        case 'M': x = n(); y = n(); sx = x; sy = y; out.push(['M', x, y]); cmd = 'L'; break;
        case 'm': x += n(); y += n(); sx = x; sy = y; out.push(['M', x, y]); cmd = 'l'; break;
        case 'L': x = n(); y = n(); out.push(['L', x, y]); break;
        case 'l': x += n(); y += n(); out.push(['L', x, y]); break;
        case 'H': x = n(); out.push(['L', x, y]); break;
        case 'h': x += n(); out.push(['L', x, y]); break;
        case 'V': y = n(); out.push(['L', x, y]); break;
        case 'v': y += n(); out.push(['L', x, y]); break;
        case 'C': { const a = [n(), n(), n(), n(), n(), n()]; out.push(['C'].concat(a)); x = a[4]; y = a[5]; break; }
        case 'c': { const a = [x + n(), y + n(), x + n(), y + n(), x + n(), y + n()]; out.push(['C'].concat(a)); x = a[4]; y = a[5]; break; }
        default: i++;
      }
    }
    return out;
  }
  /* Draws an SVG string at (X,Y) with width W (page points, y downwards). o.crop = [y0,y1] draws only that vertical slice of the viewBox. Returns the drawn height. */
  function drawSvg(doc, svg, X, Y, W, o) {
    o = o || {};
    const vb = /viewBox="([^"]+)"/.exec(svg), v = vb ? vb[1].trim().split(/[\s,]+/).map(Number) : [0, 0, 340, 200];
    const y0 = o.crop ? o.crop[0] : v[1], y1 = o.crop ? o.crop[1] : v[1] + v[3], s = W / v[2], H = (y1 - y0) * s;
    let dx = 0, dy = 0; const tX = x => X + (x + dx - v[0]) * s, tY = y => Y + (y + dy - y0) * s;
    doc.raw('q ' + f2(X) + ' ' + f2(PH - Y - H) + ' ' + f2(W) + ' ' + f2(H) + ' re W n');
    const re = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[\w:-]+\s*=\s*"[^"]*")*)\s*(\/?)>([^<]*)/g, stack = [], clips = {}; let m, inClip = null;
    const style = (a, kind) => {
      let fill, fa = 1, stroke = null, sa = 1;
      if (a.fill === undefined) fill = ((kind === 'path' || kind === 'polyline' || kind === 'line') && a.stroke !== undefined) ? null : '#000000';
      else { const p = paint(a.fill); fill = p.c; fa = p.a; }
      if (a.stroke !== undefined) { const p = paint(a.stroke); stroke = p.c; sa = p.a; }
      const op = a.opacity != null ? +a.opacity : 1; fa *= op * (a['fill-opacity'] != null ? +a['fill-opacity'] : 1); sa *= op * (a['stroke-opacity'] != null ? +a['stroke-opacity'] : 1);
      return { fill, fa, stroke, sa, lw: (a['stroke-width'] != null ? +a['stroke-width'] : 1) * s, dash: a['stroke-dasharray'] ? a['stroke-dasharray'].split(/[ ,]+/).map(Number).map(z => z * s) : null };
    };
    const P = (x, y) => [tX(+x), tY(+y)];
    while ((m = re.exec(svg))) {
      const close = m[1] === '/', name = m[2], a = close ? {} : attrs(m[3]), selfc = m[4] === '/', txt = m[5];
      if (close) { if (name === 'g') { const e = stack.pop(); if (e) { dx -= e.dx; dy -= e.dy; if (e.clip) doc.raw('Q'); } } else if (name === 'clipPath') inClip = null; continue; }
      if (name === 'svg' || name === 'defs') continue;
      if (name === 'clipPath') { inClip = a.id; continue; }
      if (inClip && name === 'rect') { clips[inClip] = { x: +a.x || 0, y: +a.y || 0, w: +a.width, h: +a.height }; continue; }
      if (name === 'g') {
        const e = { dx: 0, dy: 0, clip: false }, tr = /translate\(\s*([-\d.]+)[ ,]+([-\d.]+)/.exec(a.transform || ''); if (tr) { e.dx = +tr[1]; e.dy = +tr[2]; }
        dx += e.dx; dy += e.dy;
        const cp = /url\(#([^)]+)\)/.exec(a['clip-path'] || '');
        if (cp && clips[cp[1]]) { const c = clips[cp[1]], p = P(c.x, c.y); doc.raw('q ' + f2(p[0]) + ' ' + f2(PH - p[1] - c.h * s) + ' ' + f2(c.w * s) + ' ' + f2(c.h * s) + ' re W n'); e.clip = true; }
        if (selfc) { dx -= e.dx; dy -= e.dy; if (e.clip) doc.raw('Q'); } else stack.push(e);
        continue;
      }
      let cmds = null;
      if (name === 'rect') { const x = +a.x || 0, y = +a.y || 0, w = +a.width, h = +a.height; cmds = [['M'].concat(P(x, y)), ['L'].concat(P(x + w, y)), ['L'].concat(P(x + w, y + h)), ['L'].concat(P(x, y + h)), ['Z']]; }
      else if (name === 'polygon' || name === 'polyline') {
        const n = (a.points || '').trim().split(/[\s,]+/).map(Number); cmds = [];
        for (let i = 0; i + 1 < n.length; i += 2) cmds.push([i ? 'L' : 'M'].concat(P(n[i], n[i + 1]))); if (name === 'polygon') cmds.push(['Z']);
      }
      else if (name === 'circle') { const c = P(a.cx, a.cy), r = (+a.r) * s, k = r * 0.5523; cmds = [['M', c[0] + r, c[1]], ['C', c[0] + r, c[1] + k, c[0] + k, c[1] + r, c[0], c[1] + r], ['C', c[0] - k, c[1] + r, c[0] - r, c[1] + k, c[0] - r, c[1]], ['C', c[0] - r, c[1] - k, c[0] - k, c[1] - r, c[0], c[1] - r], ['C', c[0] + k, c[1] - r, c[0] + r, c[1] - k, c[0] + r, c[1]], ['Z']]; }
      else if (name === 'line') cmds = [['M'].concat(P(a.x1, a.y1)), ['L'].concat(P(a.x2, a.y2))];
      else if (name === 'path') {
        cmds = pathCmds(a.d || '').map(c => { if (c[0] === 'M' || c[0] === 'L') return [c[0]].concat(P(c[1], c[2])); if (c[0] === 'C') return ['C'].concat(P(c[1], c[2]), P(c[3], c[4]), P(c[5], c[6])); return c; });
      }
      else if (name === 'text') {
        const size = (+a['font-size'] || 10) * s, bold = parseInt(a['font-weight'] || 400, 10) >= 600 || a['font-weight'] === 'bold', p = paint(a.fill === undefined ? '#000000' : a.fill) || { c: '#000000', a: 1 };
        const t = ent(txt).replace(/\s+/g, ' ').trim(); if (!t) continue; const q = P(a.x, a.y);
        doc.text(q[0], q[1], t, { size, bold, align: a['text-anchor'] === 'middle' ? 'c' : a['text-anchor'] === 'end' ? 'r' : 'l', color: p.c || '#000000', alpha: p.a * (a.opacity != null ? +a.opacity : 1) });
        continue;
      }
      if (!cmds || !cmds.length) continue;
      const st = style(a, name); st.fill = st.fill || null; doc.shape(cmds, { fill: st.fill, fa: st.fa, stroke: st.stroke, sa: st.sa, lw: st.lw, dash: st.dash });
    }
    stack.forEach(e => { if (e.clip) doc.raw('Q'); });
    doc.raw('Q');
    return H;
  }

  /* ================================================================ 3 · layout ================================================================ */
  const M = 36, TOP = 58, BOT = PH - 44, CW = PW - 2 * M;
  const GREEN = '#0C9A55', CYAN = '#0A8CA0', RED = '#D92D2D', INK = '#0A0F0D', MUT = '#5E6E69';
  const isOk = s => /^OK/.test(String(s));
  function wrap(t, mw, size, bold) {
    const out = [];
    String(t == null ? '' : t).split('\n').forEach(par => {
      const words = par.split(' '); let line = '';
      words.forEach(w => {
        const test = line ? line + ' ' + w : w;
        if (textW(test, size, bold) <= mw) { line = test; return; }
        if (line) { out.push(line); line = ''; }
        if (textW(w, size, bold) <= mw) { line = w; return; }
        let piece = ''; for (const ch of w) { if (textW(piece + ch, size, bold) > mw && piece) { out.push(piece); piece = ''; } piece += ch; } line = piece;
      });
      out.push(line);
    });
    return out;
  }
  function Flow(doc, title, date) {
    let y = TOP; const F = {};
    F.doc = doc; F.y = () => y; F.setY = v => { y = v; };
    F.newPage = () => { doc.page(); y = TOP; };
    F.ensure = h => { if (y + h > BOT) F.newPage(); };
    F.gap = h => { y += h; };
    F.h2 = t => { F.ensure(90); y += 8; doc.text(M, y + 10, t, { size: 11.5, bold: true, color: GREEN }); doc.line(M, y + 15, M + CW, y + 15, { color: '#BFD3CB', lw: 0.7 }); y += 22; };
    F.h3 = t => { F.ensure(24); y += 4; doc.text(M, y + 9, t, { size: 9.5, bold: true, color: INK }); y += 15; };
    F.para = (t, o) => { o = o || {}; const size = o.size || 8.6, lh = size * 1.35, ls = wrap(t, (o.w || CW), size, o.bold); ls.forEach(l => { F.ensure(lh); doc.text(M + (o.x || 0), y + size, l, { size, bold: o.bold, color: o.color || INK }); y += lh; }); y += o.after == null ? 3 : o.after; };
    F.chip = (x, yy, text, ok, size) => { size = size || 7.5; const w = textW(text, size, true) + 14; doc.rrect(x, yy, w, 13, 6.5, { fill: ok ? '#E4F8EE' : '#FDE8E8' }); doc.text(x + 7, yy + 9.6, text, { size, bold: true, color: ok ? GREEN : RED }); return w; };
    F.kv = (rows, o) => {
      o = o || {}; const cols = o.cols || 2, gw = CW / cols;
      for (let i = 0; i < rows.length; i += cols) {
        const cells = rows.slice(i, i + cols).map(r => ({ l: r[0], v: wrap(String(r[1] == null || r[1] === '' ? '-' : r[1]), gw - 10, 9, true) }));
        const h = Math.max(...cells.map(c => 13 + c.v.length * 11)) + 3; F.ensure(h);
        cells.forEach((c, k) => { const x = M + k * gw; doc.text(x, y + 8, c.l, { size: 7.2, color: MUT }); c.v.forEach((ln, q) => doc.text(x, y + 19 + q * 11, ln, { size: 9, bold: true })); });
        y += h;
      }
      y += 2;
    };
    /* cells may be strings or {t, c (colour), b (bold)} */
    F.table = (head, rows, w, o) => {
      o = o || {}; const size = o.size || 8.2, lh = size * 1.3, pad = 3, tw = w.reduce((a, b) => a + b, 0), al = o.align || [];
      const X = (i, a, x) => a === 'r' ? x + w[i] - pad : a === 'c' ? x + w[i] / 2 : x + pad;
      const hd = () => { F.ensure(18); doc.rect(M, y, tw, 16, { fill: '#E4F1EB' }); let x = M; head.forEach((h, i) => { doc.text(X(i, al[i], x), y + 11, h, { size, bold: true, color: '#0A6B3A', align: al[i] === 'r' ? 'r' : al[i] === 'c' ? 'c' : 'l' }); x += w[i]; }); y += 16; };
      hd();
      rows.forEach((r, ri) => {
        const cs = r.map(c => (c && typeof c === 'object') ? c : { t: c }), cells = cs.map((c, i) => wrap(String(c.t == null ? '' : c.t), w[i] - 2 * pad, size, c.b));
        const n = Math.max(1, ...cells.map(c => c.length)), h = n * lh + 2 * pad - 1;
        if (y + h > BOT) { F.newPage(); hd(); }
        if (ri % 2) doc.rect(M, y, tw, h, { fill: '#F5F9F7' });
        let x = M; cells.forEach((c, i) => { c.forEach((ln, q) => doc.text(X(i, al[i], x), y + pad + size + q * lh - 1, ln, { size, bold: cs[i].b, color: cs[i].c || INK, align: al[i] === 'r' ? 'r' : al[i] === 'c' ? 'c' : 'l' })); x += w[i]; });
        y += h;
      });
      doc.line(M, y, M + tw, y, { color: '#CFDCD6', lw: 0.6 }); y += 7;
    };
    /* the step-by-step calculation: [{t, r:[[label, formula, result, highlight]]}] */
    F.steps = list => {
      const w1 = Math.round(CW * 0.24), w3 = Math.round(CW * 0.30), w2 = CW - w1 - w3, sz = 8.1, lh = sz * 1.32, pad = 3;
      list.forEach((s, si) => {
        const rows = s.r.map(r => ({ a: wrap(r[0], w1 - 2 * pad, 7.4, false), b: wrap(r[1], w2 - 2 * pad, sz, false), c: wrap(r[2], w3 - 2 * pad, sz, true), hl: !!r[3] }));
        const hOf = r => Math.max(r.a.length * 7.4 * 1.32, r.b.length * lh, r.c.length * lh) + 2 * pad;
        F.ensure(20 + (rows[0] ? hOf(rows[0]) : 0));
        const t = /^\d/.test(s.t) ? s.t : (si + 1) + ' · ' + s.t;
        doc.rect(M, y, CW, 15, { fill: '#10231B' }); doc.text(M + 6, y + 10.6, t, { size: 8.8, bold: true, color: '#FFFFFF' }); y += 15;
        rows.forEach(r => {
          const h = hOf(r); if (y + h > BOT) { F.newPage(); }
          if (r.hl) doc.rect(M, y, CW, h, { fill: '#E1F6FA' });
          r.a.forEach((l, q) => doc.text(M + pad, y + pad + 7.4 + q * 7.4 * 1.32 - 1, l, { size: 7.4, color: MUT }));
          r.b.forEach((l, q) => doc.text(M + w1 + pad, y + pad + sz + q * lh - 1, l, { size: sz }));
          r.c.forEach((l, q) => doc.text(M + w1 + w2 + pad, y + pad + sz + q * lh - 1, l, { size: sz, bold: true, color: r.hl ? CYAN : GREEN }));
          doc.line(M, y + h, M + CW, y + h, { color: '#E3ECE8', lw: 0.5 }); y += h;
        });
        y += 7;
      });
    };
    /* figure: SVG string drawn at width w (centred); crop = [y0,y1] of the viewBox */
    F.fig = (svg, o) => {
      o = o || {}; const vb = /viewBox="([^"]+)"/.exec(svg).slice(1)[0].trim().split(/[\s,]+/).map(Number), y0 = o.crop ? o.crop[0] : vb[1], y1 = o.crop ? o.crop[1] : vb[1] + vb[3];
      let w = o.w || CW; const maxH = o.maxH || (BOT - TOP - 60); if ((y1 - y0) * w / vb[2] > maxH) w = maxH * vb[2] / (y1 - y0);
      const h = (y1 - y0) * w / vb[2] + (o.title ? 14 : 0) + (o.caption ? 12 : 0) + 6; F.ensure(h);
      if (o.title) { doc.text(M, y + 9, o.title, { size: 9, bold: true, color: INK }); y += 14; }
      const x = o.x != null ? o.x : M + (CW - w) / 2;
      doc.rrect(x - 3, y - 2, w + 6, (y1 - y0) * w / vb[2] + 4, 4, { fill: '#FFFFFF', stroke: '#DCE5E1', lw: 0.6 });
      const hh = drawSvg(doc, svg, x, y, w, { crop: o.crop }); y += hh + 4;
      if (o.caption) { doc.text(M, y + 7, o.caption, { size: 7.4, color: MUT }); y += 12; }
      y += 4; return hh;
    };
    F.band = (title, sub, status) => {
      F.ensure(46); doc.rect(M, y, CW, 38, { fill: '#10231B' }); doc.rect(M, y, 5, 38, { fill: '#12C26B' });
      doc.text(M + 14, y + 16, title, { size: 13, bold: true, color: '#FFFFFF' }); doc.text(M + 14, y + 30, sub, { size: 8.3, color: '#7FE0F0' });
      if (status != null) { const ok = status === 'OK', t = ok ? 'ALL CHECKS PASSED' : 'REVIEW NEEDED', w = textW(t, 7.5, true) + 16; doc.rrect(M + CW - w - 10, y + 12, w, 15, 7.5, { fill: ok ? '#12C26B' : '#EF4444' }); doc.text(M + CW - w - 2, y + 22.4, t, { size: 7.5, bold: true, color: '#FFFFFF' }); }
      y += 46;
    };
    return F;
  }

  /* ================================================================ 4 · recompute a saved slab (same calls as the app) ================================================================ */
  const flatDef = () => { const A = (v, k) => Array(k).fill(v); return Object.assign({ id: 'FS1', sG: 1, sQ: 0.3, m2: 1, aciStrip: 'aci', fx: 4, tor: 1, ax: 1, sn: 70, sp: 60, basis: 'max', phi: 12, layer: 'outer', more: false, col: -1 },
    { L: [6, 7.5, 7.5, 6], b: A(5, 4), h: A(275, 4), g: A('', 4), q: A('', 4), c1: [400, 500, 500, 500, 400], c2: [400, 500, 500, 500, 400], Ha: A(3.2, 5), Hb: A(3.2, 5), pos: ['Edge', 'Interior', 'Interior', 'Interior', 'Edge'] }); };
  function flatFix(F) {
    const n = F.L.length;
    ['b', 'h', 'g', 'q'].forEach(k => { while (F[k].length < n) F[k].push(F[k][F[k].length - 1]); F[k].length = n; });
    ['c1', 'c2', 'Ha', 'Hb', 'pos'].forEach(k => { while (F[k].length < n + 1) F[k].push(k === 'pos' ? 'Interior' : F[k][F[k].length - 1]); F[k].length = n + 1; });
  }
  function flatData(F, cons) {
    const { E } = L(); flatFix(F); const num = a => a.map(v => v === '' || v == null ? NaN : +v);
    const g = F.g.map((v, i) => v === '' || v == null ? E.loads(cons, +F.h[i] || 0, 0, null).Gk : +v), q = F.q.map(v => v === '' || v == null ? +cons.Qk : +v);
    return { S: { L: num(F.L), b: num(F.b), h: num(F.h), g, q, c1: num(F.c1), c2: num(F.c2), Ha: num(F.Ha), Hb: num(F.Hb), pos: F.pos.slice() },
      o: { gG: +cons.gG, gQ: +cons.gQ, sG: +F.sG, sQ: +F.sQ, fx: +F.fx, tor: +F.tor, ax: +F.ax }, d: { sn: +F.sn, sp: +F.sp, basis: F.basis, phi: +F.phi, layer: F.layer, aciStrip: F.aciStrip || 'aci' } };
  }
  function ensureSp(i) {
    if (!Array.isArray(i.sp) || !i.sp.length) { const a = []; if (+i.Ll > 0) a.push({ L: +i.Ll, w: '' }); a.push({ L: +i.L > 0 ? +i.L : 3500, w: '' }); if (+i.Lr > 0) a.push({ L: +i.Lr, w: '' }); i.ds = +i.Ll > 0 ? 1 : 0; i.sp = a; }
    if (!(Number.isInteger(+i.ds) && +i.ds >= 0 && +i.ds < i.sp.length)) i.ds = 0; i.ds = +i.ds;
  }
  const DEF1 = () => ({ id: 'OW1', L: 3500, cs: 'End span', bw: '', hb: '', hov: '', addG: '', qov: '', meth: 'Coefficients', Ll: '', Lr: '', el: 'Pinned', er: 'Pinned', sp: [{ L: 3500, w: '' }, { L: 3500, w: '' }, { L: 3500, w: '' }], ds: 1 });
  const DEF2 = () => ({ id: 'TW1', lx: 4000, ly: 5000, type: 1, bw: '', hb: '', hov: '', addG: '', qov: '' });
  const DEF3 = () => ({ id: 'IR1', A: 22.36, Lx: 4600, type: 9, mode: 'Yield Line', bw: '', hb: '', hov: '', addG: '', qov: '', man: { xn: '', xp: '', yn: '', yp: '', V: '' }, yl: { nv: 4, x: [0, 8980, 8980, 4865, '', ''], y: [0, 0, -750, -4636, '', ''], e: ['S', 'S', 'S', 'S', 'S', 'S'], ri: '', Pxo: '', Pyo: '' } });
  const KIND_NAME = { one: 'One-way slab', two: 'Two-way slab', irr: 'Irregular slab', flat: 'Flat slab' };

  function compute(rec, fallbackCons) {
    const { E, E2, FL, AC } = L(), kind = rec.kind || 'one', code = rec.code === 'ACI' ? 'ACI' : 'EC2';
    const cons = Object.assign(clone(E.DEF), clone(rec.cons || fallbackCons || {}));
    const c = { rec, kind, code, cons, R: null, D: null, A: null, steps: [], err: '', id: rec.id || '' };
    try {
      if (kind === 'flat') {
        const F = Object.assign(flatDef(), clone(rec.inp || {})); flatFix(F); c.inp = F; c.id = F.id || c.id;
        const dt = flatData(F, cons), efm = FL.efm(dt.S, dt.o); c.D = FL.design(efm, cons, dt.d); c.R = c.D; c.dt = dt;
        if (code === 'ACI') { const k = AC.factors(cons), o = Object.assign({}, dt.o, { gG: k.gD, gQ: k.gL, pat: 'aci', sG: 1, sQ: +F.sQ >= 0 ? +F.sQ : 0.3 }); c.A = AC.flat(FL.efm(dt.S, o), cons, dt.d); }
        c.steps = c.A ? c.A.steps : FL.steps(c.D);
      } else if (kind === 'irr') {
        const i = Object.assign(DEF3(), clone(rec.inp || {})); c.inp = i; c.id = i.id || c.id;
        c.R = E2.design3({ A: +i.A, Lx: +i.Lx, type: +i.type, mode: i.mode, hov: +i.hov || 0, addG: +i.addG || 0, qov: i.qov === '' ? null : +i.qov, man: i.man, yl: i.yl, bw: i.bw, hb: i.hb }, cons);
        if (code === 'ACI') { c.R.inp = Object.assign({}, c.R.inp || {}, i); c.A = AC.twoWay(c.R, cons); }
        c.steps = c.A ? c.A.steps : E2.steps2(c.R);
      } else if (kind === 'two') {
        const i = Object.assign(DEF2(), clone(rec.inp || {})); c.inp = i; c.id = i.id || c.id;
        c.R = E2.design2({ lx: +i.lx, ly: +i.ly, type: +i.type, bw: i.bw, hb: i.hb, hov: +i.hov || 0, addG: +i.addG || 0, qov: i.qov === '' ? null : +i.qov }, cons);
        if (code === 'ACI') { c.R.inp = Object.assign({}, c.R.inp || {}, i); c.A = AC.twoWay(c.R, cons); }
        c.steps = c.A ? c.A.steps : E2.steps2(c.R);
      } else {
        const i = Object.assign(DEF1(), clone(rec.inp || {})); c.inp = i; c.id = i.id || c.id;
        if (i.meth === 'Continuous strip') ensureSp(i);
        const Ln = (i.meth === 'Continuous strip' && Array.isArray(i.sp) && i.sp[i.ds]) ? +i.sp[i.ds].L : +i.L;
        c.R = E.design({ cs: i.cs, L: Ln, hov: +i.hov || 0, addG: +i.addG || 0, qov: i.qov === '' ? null : +i.qov, meth: i.meth, sp: i.meth === 'Continuous strip' ? i.sp.map(x => ({ L: +x.L, w: x.w })) : undefined, ds: i.ds, Ll: +i.Ll || 0, Lr: +i.Lr || 0, spanCount: i.spanCount, bayArea: i.bayArea, el: i.el, er: i.er, bw: i.bw, hb: i.hb }, cons);
        if (code === 'ACI') { c.R.inp = Object.assign({}, c.R.inp || {}, clone(i), { L: c.R.L }); c.A = AC.oneWay(c.R, cons); }
        c.steps = c.A ? c.A.steps : E.steps(c.R);
      }
      c.status = c.A ? c.A.st.overall : c.R.st.overall;
    } catch (e) { c.err = (e && e.message) ? e.message : String(e); c.status = 'NOT OK'; }
    return c;
  }
  const typeName = c => c.kind === 'flat' ? 'Flat slab · ' + (c.D ? c.D.n : '') + ' spans' : c.kind === 'two' ? 'Two-way · type ' + c.R.cn : c.kind === 'irr' ? 'Irregular · ' + c.R.mode : 'One-way · ' + c.R.cu + (c.R.meth ? ' · continuous strip' : '');

  /* ================================================================ 5 · drawings (SVG strings, print colours) ================================================================ */
  const X = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const GRN = '#0C9A55', CY = '#0A8CA0', AMB = '#E08A00', GRY = '#8FA39C', RD = '#D92D2D';
  const T = (x, y, t, o) => { o = o || {}; return '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" font-size="' + (o.s || 8) + '" font-weight="' + (o.w || 600) + '" text-anchor="' + (o.a || 'middle') + '" fill="' + (o.c || '#5E6E69') + '">' + X(t) + '</text>'; };
  const DISC = [[], [3], [0], [0, 3], [3, 1], [0, 2], [0, 1, 3], [0, 2, 1], [0, 1, 2, 3]];
  const arrowH = (x1, y1, x2, y2, col) => { const a = Math.atan2(y2 - y1, x2 - x1), h = 4.2, p = (x, y, t) => (x + h * Math.cos(a + t)).toFixed(1) + ',' + (y + h * Math.sin(a + t)).toFixed(1);
    return '<path d="M' + x1.toFixed(1) + ' ' + y1.toFixed(1) + 'L' + x2.toFixed(1) + ' ' + y2.toFixed(1) + '" stroke="' + col + '" stroke-width="1" fill="none"/><polygon points="' + x2.toFixed(1) + ',' + y2.toFixed(1) + ' ' + p(x2, y2, Math.PI - 0.4) + ' ' + p(x2, y2, Math.PI + 0.4) + '" fill="' + col + '"/>'; };
  /* plan of a rectangular two-way panel: continuous (thick green) and discontinuous (dashed grey) edges; horizontal side = long span ly */
  function panelSvg(id, lx, ly, type, title, note) {
    const E2 = L().E2, W = 360, H = 214, aw = 230, ah = 112, s = Math.min(aw / ly, ah / lx), w = ly * s, h = lx * s, ox = (W - w) / 2 - 8, oy = 44 + (ah - h) / 2, dis = DISC[Math.max(0, Math.min(8, type - 1))] || [];
    let b = T(8, 13, title, { a: 'start', c: GRN, w: 700, s: 10 }) + T(8, 25, (E2.CASES2[type - 1] || { n: '' }).n, { a: 'start', s: 7.5, w: 500 });
    b += '<rect x="' + ox.toFixed(1) + '" y="' + oy.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '" fill="#12C26B" fill-opacity=".10"/>';
    const e = [[ox, oy, ox + w, oy], [ox + w, oy, ox + w, oy + h], [ox, oy + h, ox + w, oy + h], [ox, oy, ox, oy + h]];
    e.forEach((p, k) => { const d = dis.indexOf(k) >= 0; b += '<path d="M' + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + 'L' + p[2].toFixed(1) + ' ' + p[3].toFixed(1) + '" stroke="' + (d ? GRY : GRN) + '" stroke-width="' + (d ? 1.5 : 4) + '" ' + (d ? 'stroke-dasharray="4 3"' : '') + ' fill="none"/>'; });
    const cx = ox + w / 2, cy = oy + h / 2, ax = Math.min(w * 0.36, 70), ay = Math.min(h * 0.34, 38);
    b += arrowH(cx - ax, cy, cx + ax, cy, CY) + arrowH(cx + ax, cy, cx - ax, cy, CY) + arrowH(cx, cy - ay, cx, cy + ay, CY) + arrowH(cx, cy + ay, cx, cy - ay, CY);
    b += T(cx + ax + 3, cy - 3, 'ly', { a: 'start', c: CY, s: 8, w: 700 }) + T(cx + 4, cy - ay - 3, 'lx', { a: 'start', c: CY, s: 8, w: 700 });
    const yb = oy + h + 14; b += '<path d="M' + ox.toFixed(1) + ' ' + yb.toFixed(1) + 'H' + (ox + w).toFixed(1) + 'M' + ox.toFixed(1) + ' ' + (yb - 3).toFixed(1) + 'v6M' + (ox + w).toFixed(1) + ' ' + (yb - 3).toFixed(1) + 'v6" stroke="#0DAFCB" stroke-width="1" fill="none"/>' + T(cx, yb + 10, 'ly = ' + Math.round(ly) + ' mm', { c: CY, s: 8.5, w: 700 });
    const xr = ox + w + 13; b += '<path d="M' + xr.toFixed(1) + ' ' + oy.toFixed(1) + 'V' + (oy + h).toFixed(1) + 'M' + (xr - 3).toFixed(1) + ' ' + oy.toFixed(1) + 'h6M' + (xr - 3).toFixed(1) + ' ' + (oy + h).toFixed(1) + 'h6" stroke="#0DAFCB" stroke-width="1" fill="none"/>' + T(xr + 6, oy + h / 2 - 2, 'lx =', { a: 'start', c: CY, s: 8.5, w: 700 }) + T(xr + 6, oy + h / 2 + 8, Math.round(lx) + ' mm', { a: 'start', c: CY, s: 8.5, w: 700 });
    b += '<path d="M8 ' + (H - 12) + 'h18" stroke="' + GRN + '" stroke-width="4"/>' + T(30, H - 9, 'continuous edge', { a: 'start', s: 7.2, w: 500 }) + '<path d="M104 ' + (H - 12) + 'h18" stroke="' + GRY + '" stroke-width="1.5" stroke-dasharray="4 3"/>' + T(126, H - 9, 'discontinuous edge', { a: 'start', s: 7.2, w: 500 });
    if (note) b += T(W - 8, H - 9, note, { a: 'end', s: 7.2, w: 500 });
    return '<svg viewBox="0 0 ' + W + ' ' + H + '">' + b + '</svg>';
  }
  /* yield-line polygon of an irregular slab (same geometry as the app preview) */
  function polySvg(id, y, i, R) {
    const W = 360, H = 214, m = 30, top = 36, ah = 150, dxm = (y.xmax - y.xmin) || 1, dym = (y.ymax - y.ymin) || 1, s = Math.min((W - 2 * m) / dxm, ah / dym), ox = (W - dxm * s) / 2, oy0 = top + (ah - dym * s) / 2;
    const Xp = x => ox + (x - y.xmin) * s, Yp = v => oy0 + (y.ymax - v) * s;
    const pts = y.P.map(p => Xp(p[0]).toFixed(1) + ',' + Yp(p[1]).toFixed(1)).join(' ');
    let b = T(8, 13, id + ' · Irregular slab (yield-line polygon)', { a: 'start', c: GRN, w: 700, s: 10 }) + T(8, 25, y.conv + ' polygon · ' + y.nv + ' vertices · area ' + (+y.Aabs).toFixed(2) + ' m²' + (isFinite(+i.A) && +i.A > 0 ? ' (entered ' + (+i.A).toFixed(2) + ' m²)' : ''), { a: 'start', s: 7.5, w: 500 });
    b += '<polygon points="' + pts + '" fill="#12C26B" fill-opacity=".13" stroke="' + GRN + '" stroke-width="1.8"/>';
    if (y.msag > 0) y.P.forEach(p => { b += '<path d="M' + Xp(y.Pxs).toFixed(1) + ' ' + Yp(y.Pys).toFixed(1) + 'L' + Xp(p[0]).toFixed(1) + ' ' + Yp(p[1]).toFixed(1) + '" stroke="#0DAFCB" stroke-width="1" stroke-dasharray="3 2" fill="none"/>'; });
    y.ed.forEach(e => { const mx = Xp(e.x + e.dx / 2), my = Yp(e.y + e.dy / 2), c = e.rho > 0; b += '<circle cx="' + mx.toFixed(1) + '" cy="' + my.toFixed(1) + '" r="6.5" fill="' + (c ? '#0C9A55' : '#FFFFFF') + '" stroke="' + GRN + '" stroke-width="1"/>' + T(mx, my + 2.8, c ? 'C' : 'S', { c: c ? '#FFFFFF' : '#0A0F0D', s: 7.5, w: 700 }); });
    y.P.forEach((p, k) => { b += '<circle cx="' + Xp(p[0]).toFixed(1) + '" cy="' + Yp(p[1]).toFixed(1) + '" r="6.5" fill="#12B5D0" stroke="#FFFFFF" stroke-width="1.2"/>' + T(Xp(p[0]), Yp(p[1]) + 2.8, String(k + 1), { c: '#0A0F0D', s: 7.5, w: 700 }); });
    if (y.msag > 0) b += '<circle cx="' + Xp(y.Pxs).toFixed(1) + '" cy="' + Yp(y.Pys).toFixed(1) + '" r="5" fill="#12C26B" stroke="#FFFFFF" stroke-width="1.2"/>';
    b += T(8, H - 8, 'C = continuous edge · S = simple edge · green dot = fan apex · numbers = vertices', { a: 'start', s: 6.8, w: 500 });
    return '<svg viewBox="0 0 ' + W + ' ' + H + '">' + b + '</svg>';
  }
  function planSvgOf(c) {
    if (c.kind === 'two') { const i = c.inp; return panelSvg(c.id, +i.lx, +i.ly, +i.type, c.id + ' · Two-way slab', (c.R.lxs !== +i.lx || c.R.lys !== +i.ly) ? 'effective ' + Math.round(c.R.lxs) + ' × ' + Math.round(c.R.lys) + ' mm' : ''); }
    if (c.kind === 'irr') {
      const i = c.inp, R = c.R; if (i.mode === 'Yield Line' && R.yl && R.yl.P && R.yl.P.length >= 3) return polySvg(c.id, R.yl, i, R);
      const lx = +i.Lx, ly = (+i.A * 1e6) / (+i.Lx || 1); return panelSvg(c.id, lx, ly, +i.type, c.id + ' · Irregular slab (equivalent rectangle)', 'area ' + (+i.A).toFixed(2) + ' m²');
    }
    return null;
  }
  /* one-way: simply supported / coefficient sketch */
  function spanSketchSvg(c) {
    const R = c.R, W = 360, H = 110; let b = T(8, 13, c.id + ' · ' + R.cu, { a: 'start', c: GRN, w: 700, s: 10 }) + T(8, 25, 'Design span L = ' + R.L + ' mm · strip 1 m wide', { a: 'start', s: 7.5, w: 500 });
    const x0 = 40, x1 = W - 40; b += '<path d="M' + x0 + ' 42H' + x1 + '" stroke="' + GRN + '" stroke-width="1.4"/>'; for (let k = 0; k <= 12; k++) b += arrowH(x0 + (x1 - x0) * k / 12, 42, x0 + (x1 - x0) * k / 12, 56, GRN);
    b += '<rect x="' + x0 + '" y="58" width="' + (x1 - x0) + '" height="10" fill="#C8D4D0" stroke="#7D8D88"/><polygon points="' + x0 + ',68 ' + (x0 - 7) + ',80 ' + (x0 + 7) + ',80" fill="#0A0F0D"/><polygon points="' + x1 + ',68 ' + (x1 - 7) + ',80 ' + (x1 + 7) + ',80" fill="#0A0F0D"/>';
    b += '<path d="M' + x0 + ' 94H' + x1 + 'M' + x0 + ' 91v6M' + x1 + ' 91v6" stroke="#0DAFCB" stroke-width="1" fill="none"/>' + T(W / 2, 106, 'L = ' + R.L + ' mm', { c: CY, s: 8.5, w: 700 });
    return '<svg viewBox="0 0 ' + W + ' ' + H + '">' + b + '</svg>';
  }
  /* detailing, one-way: section + plan */
  function oneWayDetailSvg(c) {
    const R = c.R, A = c.A, fs = A ? A.fs : R.fs, fh = A ? A.fh : R.fh, sp = f => f ? (f.sp || f.s) : null, txt = f => f ? f.txt : '', h = R.h;
    const sB = sp(fs), sT = sp(fh), nb = Math.min(12, Math.max(2, Math.round(190 / (sB || 200)))), nt = Math.min(12, Math.max(2, Math.round(190 / (sT || 200))));
    const dots = (n, y, col) => Array.from({ length: n }, (_, k) => '<circle cx="' + (44 + (k + .5) * (182 / n)).toFixed(1) + '" cy="' + y + '" r="3" fill="' + col + '"/>').join('');
    let b = T(8, 12, 'Section (1 m strip)', { a: 'start', c: GRN, w: 700, s: 9.5 });
    b += '<rect x="40" y="26" width="190" height="52" fill="#E3EAE7" stroke="#7D8D88"/>' + (fs ? dots(nb, 70, GRN) : '') + (fh ? dots(nt, 34, CY) : '') + '<path d="M240 26v52M237 26h6M237 78h6" stroke="#7D8D88" fill="none"/>' + T(246, 56, 'h = ' + h, { a: 'start', s: 8, w: 600, c: '#5E6E69' });
    b += T(135, 94, (fs ? 'Bottom ' + txt(fs) : '') + (fh ? '   ·   Top ' + txt(fh) : ''), { c: GRN, s: 8.2, w: 700 });
    b += T(8, 118, 'Plan view', { a: 'start', c: GRN, w: 700, s: 9.5 });
    const ln = Array.from({ length: nb }, (_, k) => '<path d="M' + (52 + k * (170 / Math.max(nb - 1, 1))).toFixed(1) + ' 128v84" stroke="' + GRN + '" stroke-width="1.3"/>').join('');
    b += '<rect x="40" y="124" width="190" height="94" fill="none" stroke="#7D8D88"/>' + ln + Array.from({ length: 5 }, (_, k) => '<path d="M46 ' + (138 + k * 17) + 'h178" stroke="#12B5D0" stroke-width="1" stroke-dasharray="4 2" fill="none"/>').join('');
    if (fh) b += '<rect x="40" y="124" width="50" height="94" fill="#12B5D0" fill-opacity=".18"/>';
    b += T(165, 232, 'green = bottom bars · cyan dashed = distribution bars · cyan zone = top bars at the support', { s: 7, w: 500 });
    return '<svg viewBox="0 0 330 240">' + b + '</svg>';
  }
  function slabPlanDetailSvg(c) {
    const R = c.R, A = c.A, sx = A ? A.fsx : R.fsx, sy = A ? A.fsy : R.fsy, sp = f => f ? (f.sp || f.s) : null, nx = Math.min(12, Math.max(2, Math.round(190 / (sp(sx) || 200)))), ny = Math.min(12, Math.max(2, Math.round(100 / ((sp(sy) || 200) * 0.55))));
    const cor = (R.cs && R.cs.cor) || 0, vl = Array.from({ length: nx }, (_, k) => '<path d="M' + (46 + k * (178 / Math.max(nx - 1, 1))).toFixed(1) + ' 36v88" stroke="' + GRN + '" stroke-width="1.3"/>').join(''), hl = Array.from({ length: ny }, (_, k) => '<path d="M46 ' + (38 + k * (84 / Math.max(ny - 1, 1))).toFixed(1) + 'h178" stroke="#12B5D0" stroke-width="1.1" stroke-dasharray="4 2" fill="none"/>').join('');
    const cors = [[40, 30], [222, 30], [40, 122], [222, 122]].slice(0, cor).map(p => '<rect x="' + p[0] + '" y="' + p[1] + '" width="8" height="8" fill="#F5A524" fill-opacity=".5" stroke="#E08A00"/>').join('');
    let b = T(8, 14, 'Plan (schematic)', { a: 'start', c: GRN, w: 700, s: 9.5 }) + '<rect x="40" y="30" width="190" height="100" fill="none" stroke="#7D8D88"/>' + vl + hl + cors;
    b += T(165, 146, 'Bottom X (short span): ' + (sx ? sx.txt : '-') + ' · Bottom Y (long span): ' + (sy ? sy.txt : '-'), { s: 7.6, w: 700, c: GRN });
    b += T(165, 158, 'green = bottom X · cyan dashed = bottom Y · amber = corner torsion reinforcement', { s: 7, w: 500 });
    return '<svg viewBox="0 0 330 166">' + b + '</svg>';
  }
  /* continuous-strip model for the BMD / SFD of one-way slabs (EC2 loads, or the ACI-scaled loads when the ACI design was chosen) */
  function stripModel(c) {
    const { E } = L(), i = c.inp, cons = c.cons; ensureSp(i);
    const ld = E.loads(cons, +i.hov || cons.h, +i.addG || 0, (i.qov === '' || i.qov == null) ? null : +i.qov), sc = c.A ? c.A.U / ld.n : 1;
    const sp = i.sp.map(x => ({ L: (+x.L || 0) / 1000, w: (x.w === '' || x.w == null || isNaN(+x.w)) ? (c.A ? c.A.U : ld.n) : +x.w * sc }));
    return { m: E.multiSpan(sp, i.el, i.er), sp, el: i.el, er: i.er, k: i.ds, n0: ld.n };
  }

  /* ================================================================ 6 · report content ================================================================ */
  const gF = (v, n) => { try { return L().E.g(v, n); } catch (e) { return String(v); } };
  const EC_LAB = { an: 'Analysis', analysis: 'Analysis / coefficients', flex: 'Flexure', spacing: 'Bar spacing', shear: 'Shear', defl: 'Deflection', crack: 'Crack control', cv: 'Coefficients valid', anchorage: 'Anchorage / lap', punch: 'Punching shear' };
  const EC_ORDER = ['an', 'analysis', 'flex', 'spacing', 'shear', 'punch', 'defl', 'crack', 'cv', 'anchorage'];

  function summaryRows(c) {
    if (c.A) return c.A.summary.map(x => [x[0], x[1]]);
    const R = c.R, { FL } = L();
    if (c.kind === 'flat') { const D = c.D; return D.spans.map(s => ['Span ' + (s.i + 1), 'CS ' + s.cs.S.txt + ' / ' + s.cs.L.txt + ' / ' + s.cs.R.txt + ' · MS ' + s.ms.S.txt + ' / ' + s.ms.L.txt + ' / ' + s.ms.R.txt]).concat(D.punch.filter(q => q.links).map(q => ['Links col ' + FL.nm(q.j), 'Ø' + D.c.phiL + ' ' + q.links.legs + ' legs × ' + q.links.nP + ' perimeters'])); }
    if (c.kind === 'one') return [['Bottom', R.fs ? R.fs.txt : '-'], ['Top', R.fh ? R.fh.txt : '-'], ['Distribution', R.sec.txt]].concat(R.end ? [['End-support top', R.end.txt]] : []);
    const top = (f, e) => f ? f.txt : (e ? e.txt + ' (nominal)' : '-');
    return [['Bottom X', R.fsx ? R.fsx.txt : '-'], ['Bottom Y', R.fsy ? R.fsy.txt : '-'], ['Top X', top(R.fhx, R.ex)], ['Top Y', top(R.fhy, R.ey)]].concat(R.tors ? [['Corner', R.tors.txt + ' over ' + gF(R.tors.len, 0) + ' mm']] : []);
  }
  function metricsOf(c) {
    if (c.A) return c.A.metrics.map(m => [m[0], m[1] + ' ' + (m[2] || '')]);
    const R = c.R;
    if (c.kind === 'flat') { const v = c.D.R.gov; return [['M sagging max', gF(v.Mp, 1) + ' kNm'], ['M hogging max', gF(v.Mh, 1) + ' kNm'], ['V max', gF(v.V, 1) + ' kN']]; }
    if (c.kind === 'one') return [['M sagging', gF(R.Ms, 2) + ' kNm/m'], ['M hogging', gF(R.Mh || 0, 2) + ' kNm/m'], ['V support', gF(R.V, 2) + ' kN/m'], ['Design load n', gF(R.ld.n, 2) + ' kN/m²']];
    return [['Msx+ / Msx-', gF(R.M.xp, 2) + ' / ' + gF(R.M.xn, 2) + ' kNm/m'], ['Msy+ / Msy-', gF(R.M.yp, 2) + ' / ' + gF(R.M.yn, 2) + ' kNm/m'], ['V support', gF(R.V, 2) + ' kN/m'], ['Design load n', gF(R.ld.n, 2) + ' kN/m²']];
  }
  function consBlock(F, c) {
    const k = c.cons;
    F.h3('Materials and design parameters');
    F.kv([['Concrete fck', k.fck + ' N/mm²'], ['Steel fyk', k.fyk + ' N/mm²'], ['fctm', k.fctm + ' N/mm²'], ['Cover', k.cover + ' mm'], ['Default slab h', k.h + ' mm'], ['Main bar Ø', k.phi + ' mm'], ['Link bar Ø', k.phiL + ' mm'], ['Strip width b', k.b + ' mm'], ['γc / γs', k.gc + ' / ' + k.gs],
      ['αcc', k.acc], ["K′ limit", k.Kl], ['cot θ', k.cot], ['Crack width wk', k.wk + ' mm'], ['Lap factor α6', k.a6], ['Bars to support', k.frac]], { cols: 3 });
    F.h3('Loads');
    const dead = Object.keys(k.dead || {}).map(n => [n, gF(k.dead[n], 3) + ' kN/m²']);
    F.kv(dead.concat([['Live load Qk', k.Qk + ' kN/m²'], ['EC2 factors γG / γQ / ψ2', k.gG + ' / ' + k.gQ + ' / ' + k.psi2], ['ACI factors D / L', (k.aciGD || 1.2) + ' / ' + (k.aciGL || 1.6)]]), { cols: 3 });
  }
  function inputBlock(F, c) {
    const i = c.inp, R = c.R, { E2 } = L(), has = v => !(v === '' || v == null), ovr = [];
    const beam = [], over = [];
    if (c.kind !== 'flat') { if (has(i.bw)) beam.push(['Support beam width bw', i.bw + ' mm']); if (has(i.hb)) beam.push(['Support beam depth hb', i.hb + ' mm']); if (has(i.hov)) over.push(['Slab thickness override', i.hov + ' mm']); if (has(i.addG)) over.push(['Extra dead load', i.addG + ' kN/m²']); if (has(i.qov)) over.push(['Live load override', i.qov + ' kN/m²']); }
    F.h3('Slab data');
    if (c.kind === 'one') {
      const strip = i.meth === 'Continuous strip', rows = [['Slab ID', i.id], ['Analysis method', i.meth], ['Slab thickness h', R.h + ' mm'], ['Span condition', R.cu]];
      if (!strip) { rows.push(['Design span L', i.L + ' mm']); if (+i.Ll > 0) rows.push(['Adjacent span (left)', i.Ll + ' mm']); if (+i.Lr > 0) rows.push(['Adjacent span (right)', i.Lr + ' mm']); if (has(i.spanCount)) rows.push(['Number of spans', i.spanCount]); if (has(i.bayArea)) rows.push(['Bay area', i.bayArea]); }
      else { rows.push(['End conditions', 'Left ' + i.el + ' · Right ' + i.er]); rows.push(['Design span', 'Span ' + (i.ds + 1) + ' (reinforcement designed for it)']); }
      F.kv(rows.concat(beam, over), { cols: 2 });
      if (strip) { F.table(['Span', 'Length L (mm)', 'Design load w (kN/m per 1 m strip)'], i.sp.map((x, k) => [String(k + 1) + (k === i.ds ? '  (design span)' : ''), String(x.L), (x.w === '' || x.w == null) ? 'n = ' + gF(R.ld.n, 3) + ' (slab design load)' : String(x.w)]), [120, 140, CW - 260], { align: ['l', 'r', 'l'] }); }
    } else if (c.kind === 'two') {
      F.kv([['Slab ID', i.id], ['Panel type', i.type + ' · ' + ((E2.CASES2[i.type - 1] || {}).n || '')], ['Short span lx', i.lx + ' mm'], ['Long span ly', i.ly + ' mm'], ['Effective spans used', Math.round(R.lxs) + ' × ' + Math.round(R.lys) + ' mm'], ['Slab thickness h', R.h + ' mm']].concat(beam, over), { cols: 2 });
    } else if (c.kind === 'irr') {
      const rows = [['Slab ID', i.id], ['Method', i.mode], ['Area A', i.A + ' m²'], ['Representative short span Lx', i.Lx + ' mm'], ['Panel type', i.type + ' · ' + ((E2.CASES2[i.type - 1] || {}).n || '')], ['Slab thickness h', R.h + ' mm']];
      F.kv(rows.concat(beam, over), { cols: 2 });
      if (i.mode === 'Yield Line') {
        const y = i.yl, n = +y.nv, tb = []; for (let k = 0; k < n; k++) tb.push([String(k + 1), String(y.x[k]), String(y.y[k]), 'Edge ' + (k + 1) + ' → ' + ((k + 1) % n + 1) + ' : ' + (y.e[k] === 'C' ? 'continuous' : 'simple')]);
        F.table(['Vertex', 'x (mm)', 'y (mm)', 'Edge to next vertex'], tb, [60, 90, 90, CW - 240], { align: ['c', 'r', 'r', 'l'] });
        F.kv([['Hogging ratio i', has(y.ri) ? y.ri : '1.0 (default)'], ['Fan apex', (has(y.Pxo) || has(y.Pyo)) ? 'x = ' + y.Pxo + ', y = ' + y.Pyo + ' mm' : 'automatic']], { cols: 2 });
      } else if (i.mode === 'Manual (FE)') F.kv([['Msx−', i.man.xn + ' kNm/m'], ['Msx+', i.man.xp + ' kNm/m'], ['Msy−', i.man.yn + ' kNm/m'], ['Msy+', i.man.yp + ' kNm/m'], ['V Ed (support line)', i.man.V + ' kN/m']], { cols: 3 });
    } else {
      const F0 = i, n = F0.L.length;
      F.kv([['Frame name', F0.id], ['Number of spans', n], ['Column strip share hogging / sagging (EC2)', F0.sn + ' % / ' + F0.sp + ' %'], ['Design basis', F0.basis === 'span' ? 'Each span' : 'Maximum values'], ['Main bar Ø', F0.phi + ' mm'], ['Layer of this direction', F0.layer === 'inner' ? 'Inner' : 'Outer'],
        ['Column far ends', +F0.fx === 4 ? 'Fixed (4EI/H)' : 'Pinned (3EI/H)'], ['Torsional member', +F0.tor ? 'Included' : 'Ignored'], ['Column axial deformation', +F0.ax ? 'Included' : 'Ignored'], ['Service factors G / Q (ψ2)', F0.sG + ' / ' + F0.sQ], ['ACI strip shares', F0.aciStrip === 'user' ? 'Same % as EC2' : 'ACI 8.10.5 (75 / 100 / 60 %)']], { cols: 2 });
      const dt = c.dt.S; F.table(['Span', 'L (m)', 'l2 (m)', 'h (mm)', 'gk (kN/m²)', 'qk (kN/m²)'], dt.L.map((_, k) => [String(k + 1), gF(dt.L[k], 3), gF(dt.b[k], 3), String(dt.h[k]), gF(dt.g[k], 3), gF(dt.q[k], 3)]), [60, 85, 85, 85, 104, 104], { align: ['c', 'r', 'r', 'r', 'r', 'r'] });
      F.table(['Column', 'Position', 'c1 along frame (mm)', 'c2 across (mm)', 'H above (m)', 'H below (m)'], dt.c1.map((_, k) => [L().FL.nm(k), dt.pos[k], String(dt.c1[k]), String(dt.c2[k]), String(dt.Ha[k]), String(dt.Hb[k])]), [60, 85, 120, 100, 79, 79], { align: ['c', 'l', 'r', 'r', 'r', 'r'] });
    }
    consBlock(F, c);
    if (c.kind !== 'flat' && c.R.ld) F.kv([['Gk (dead, incl. self-weight)', gF(c.R.ld.Gk, 3) + ' kN/m²'], ['Qk (live)', gF(c.R.ld.Qk, 3) + ' kN/m²'], [c.A ? 'Factored load U (ACI)' : 'Design load n (EC2)', c.A ? gF(c.A.U, 3) + ' kN/m²' : gF(c.R.ld.n, 3) + ' kN/m²']], { cols: 3 });
  }
  function resultsBlock(F, c) {
    const st = c.A ? c.A.st : c.R.st, keys = c.A ? c.A.keys : EC_ORDER.filter(k => st[k] !== undefined).map(k => [k, EC_LAB[k]]);
    const shown = keys.filter(k => st[k[0]] !== undefined), nOk = shown.filter(k => isOk(st[k[0]])).length;
    F.ensure(26); const ok = st.overall === 'OK';
    F.chip(M, F.y(), ok ? 'ALL CHECKS PASSED' : 'REVIEW NEEDED', ok); F.doc.text(M + 112, F.y() + 9.5, nOk + ' of ' + shown.length + ' checks OK · ' + (c.A ? 'ACI 318-25' : 'Eurocode 2'), { size: 8, color: MUT }); F.gap(20);
    F.kv(metricsOf(c), { cols: 3 });
    F.h3('Reinforcement' + (c.kind === 'flat' ? ' (per metre of strip)' : ''));
    F.table(['Item', 'Provided'], summaryRows(c).map(r => [{ t: r[0], b: true }, r[1]]), [170, CW - 170]);
    F.h3('Checks');
    F.table(['Check', 'Result', 'Remark'], shown.map(k => { const s = String(st[k[0]]), good = isOk(s); return [k[1], { t: good ? 'OK' : (s === '-' ? 'n/a' : 'NOT OK'), c: good ? GREEN : (s === '-' ? MUT : RED), b: true }, { t: good ? (s.length > 2 ? s : '') : (s === '-' ? '' : s), c: good ? MUT : RED }]; }), [130, 60, CW - 190], { align: ['l', 'c', 'l'] });
    if (c.kind === 'flat') {
      F.h3('Punching shear');
      if (c.A) F.table(['Column', 'Position', 'Vu (kN)', 'Msc (kNm)', 'vu (MPa)', 'φvc (MPa)', 'Status'], c.A.punch.map(p => [L().FL.nm(p.j), p.pos, gF(p.Vu, 0), gF(p.Msc, 1), gF(p.vu, 2), gF(p.phiVc, 2), { t: /^OK \(/.test(p.st) ? 'OK with stirrups' : (isOk(p.st) ? 'OK' : 'NOT OK'), c: isOk(p.st) ? GREEN : RED, b: true }]), [52, 62, 70, 76, 70, 76, CW - 406], { align: ['c', 'l', 'r', 'r', 'r', 'r', 'l'] });
      else F.table(['Column', 'Position', 'VEd (kN)', 'MEd (kNm)', 'vEd (MPa)', 'vRd,c (MPa)', 'Status'], c.D.punch.map(p => [L().FL.nm(p.j), p.pos, gF(p.VEd, 0), gF(p.MEd, 1), gF(p.v1, 2), gF(p.vrdc, 2), { t: /^OK \(/.test(p.st) ? 'OK with links' : (isOk(p.st) ? 'OK' : 'NOT OK'), c: isOk(p.st) ? GREEN : RED, b: true }]), [52, 62, 70, 76, 70, 76, CW - 406], { align: ['c', 'l', 'r', 'r', 'r', 'r', 'l'] });
    }
    if (c.A && c.A.notes) c.A.notes.forEach(n => F.para('• ' + n, { size: 7.8, color: MUT, after: 2 }));
  }
  function diagramsBlock(F, c) {
    const { FL, ST } = L();
    if (c.kind === 'one' && c.R.ms) {
      F.h2('Continuous strip · BMD and SFD');
      const model = stripModel(c), svg = ST.svg(model), m = model.m;
      F.fig(svg, { crop: [0, 114], w: 440, title: 'Strip, design loads and supports', caption: 'w = factored design load per 1 m strip (' + (c.A ? 'ACI 318-25' : 'Eurocode 2') + '); shaded span = design span.' });
      F.fig(svg, { crop: [114, 233], w: 440, title: 'Bending moment diagram (BMD) · kNm per metre strip · sagging plotted downward' });
      F.fig(svg, { crop: [236, 348], w: 440, title: 'Shear force diagram (SFD) · kN per metre strip' });
      const ms = Math.max(...m.spans.map(s => s.Ms)), mh = Math.max(...m.sup.map(v => Math.max(0, -v))), v = Math.max(...m.spans.map(s => Math.max(Math.abs(s.VA), Math.abs(s.VB))));
      F.kv([['M sagging max', gF(ms, 2) + ' kNm/m'], ['M hogging max', gF(mh, 2) + ' kNm/m'], ['V max', gF(v, 2) + ' kN/m']], { cols: 3 });
    } else if (c.kind === 'flat') {
      F.h2('Equivalent frame · BMD and SFD');
      const R = c.A ? c.A.R : c.D.R, svg = FL.diagrams(R);
      F.fig(svg, { crop: [0, 138], w: 470, title: 'Equivalent frame and loads' + (c.A ? ' (ACI case A)' : ' (case A, ULS)') });
      F.fig(svg, { crop: [138, 309], w: 470, title: 'Bending moment envelope (BMD) · kNm · slabs and column end moments' });
      F.fig(svg, { crop: [310, 489], w: 470, title: 'Shear force envelope (SFD) · kN · slabs, column shear and axial load N', caption: 'Hogging negative, sagging plotted downward. ' + (c.A ? 'ACI 6.4.3 pattern loading (75 % L).' : 'Envelope of load cases A, B and C.') });
      const v = R.gov;
      F.kv([['M sagging max (span ' + (v.iMp + 1) + ')', gF(v.Mp, 1) + ' kNm'], ['M hogging max (centre-line, column ' + L().FL.nm(v.jMh) + ')', gF(v.Mh, 1) + ' kNm'], ['V max (span ' + (v.iV + 1) + ')', gF(v.V, 1) + ' kN']], { cols: 3 });
      F.table(['Col', 'N max (kN)', 'N min (kN)', 'M unbal. (kNm)', 'M above', 'M below', 'k_ec / k_c'], R.cols.map((q, j) => [FL.nm(j), gF(q.N, 1), gF(q.Nmin, 1), gF(q.M, 1), gF(q.Ma, 1), gF(q.Mb, 1), q.kec.toFixed(3)]), [40, 80, 80, 90, 78, 78, CW - 446], { align: ['c', 'r', 'r', 'r', 'r', 'r', 'r'] });
    }
  }
  function detailBlock(F, c) {
    const { FL, E } = L();
    F.h2('Detailing (schematic)');
    if (c.kind === 'one') {
      F.fig(oneWayDetailSvg(c), { w: 400, caption: 'Schematic only; bar positions follow the provided spacing.' });
      const R = c.R, bits = []; if (R.lbs) bits.push('anchorage length lbd = ' + gF(R.lbs, 0) + ' mm'); if (R.l0) bits.push('lap length l0 = ' + gF(R.l0, 0) + ' mm'); if (bits.length) F.para(bits.join(' · '), { size: 8.4, bold: true, color: GREEN });
    } else if (c.kind === 'two' || c.kind === 'irr') {
      F.fig(slabPlanDetailSvg(c), { w: 400, caption: 'Schematic only; bar positions follow the provided spacing.' });
      const R = c.R, lb = R.lb ? Math.max(...Object.values(R.lb).map(x => +x || 0)) : 0, bits = []; if (lb) bits.push('max. anchorage length lbd = ' + gF(lb, 0) + ' mm'); if (R.l0) bits.push('lap length l0 = ' + gF(R.l0, 0) + ' mm'); if (bits.length) F.para(bits.join(' · '), { size: 8.4, bold: true, color: GREEN });
    } else if (c.A) {
      F.para('Bars of the ACI 318-25 design (per metre of strip):', { size: 8.4, color: MUT });
      F.table(['Zone', 'Reinforcement'], c.A.bars.map(b => [{ t: b[0], b: true }, b[1]]), [200, CW - 200]);
      F.para('Bar extensions follow ACI 8.7.4.1.3 (Fig.); end-column bottom bars are anchored per 8.7.4.2.2. Run the EC2 design to obtain the detailing drawings of the frame.', { size: 7.8, color: MUT });
    } else {
      const D = c.D, cnt = (w, s) => Math.floor(w * 1000 / s) + 1;
      F.fig(FL.detail(D), { w: 440, title: 'Elevation and plan of the frame strip (schematic)', crop: [0, 262] });
      F.h3('Bottom bars');
      F.table(['Span', 'Column strip', 'Middle strip'], D.spans.map(s => [String(s.i + 1), s.cs.S.txt + ' (' + cnt(s.bcs, s.cs.S.s) + ' bars)', s.ms.S.txt + ' (' + cnt(s.bms, s.ms.S.s) + ' bars)']), [60, (CW - 60) / 2, (CW - 60) / 2], { align: ['c', 'l', 'l'] });
      F.h3('Top bars over the columns');
      F.table(['Column', 'Column strip', 'Middle strip', 'Extension from the column centre'], D.det.map((x, j) => {
        const zc = [j > 0 ? D.spans[j - 1].cs.R : null, j < D.n ? D.spans[j].cs.L : null].filter(Boolean).reduce((a, b) => b.Asp > a.Asp ? b : a), zm = [j > 0 ? D.spans[j - 1].ms.R : null, j < D.n ? D.spans[j].ms.L : null].filter(Boolean).reduce((a, b) => b.Asp > a.Asp ? b : a);
        return [FL.nm(j), zc.txt, zm.txt, (x.left ? '← ' + gF(x.left.x, 2) + ' m' : '') + (x.left && x.right ? ' · ' : '') + (x.right ? gF(x.right.x, 2) + ' m →' : '')];
      }), [52, 100, 100, CW - 252], { align: ['c', 'l', 'l', 'l'] });
      F.para('At least 50 % of the column-strip steel within 0.125·l2 each side of the column; bar lengths include contraflexure + d + lbd.', { size: 7.8, color: MUT });
      const lk = D.punch.filter(q => q.links);
      F.h3('Punching links');
      if (lk.length) F.table(['Column', 'Links', 'Layout'], lk.map(q => [FL.nm(q.j), 'Ø' + D.c.phiL + ' · ' + q.links.legs + ' legs per perimeter', q.links.nP + ' perimeters · sr = ' + gF(q.links.sr, 0) + ' mm · first at 0.5d']), [60, 190, CW - 250], { align: ['c', 'l', 'l'] }); else F.para('No punching links are required.', { size: 8.4, color: GREEN, bold: true });
      const gp = D.punch.reduce((a, b) => b.ratio > a.ratio ? b : a);
      F.fig(FL.punchSvg(gp, D), { w: 360, title: 'Punching control · column ' + FL.nm(gp.j) + ' (' + gp.pos + ') · governing column', caption: 'vEd = ' + gF(gp.v1, 2) + ' MPa ' + (gp.v1 <= gp.vrdc ? '≤' : '>') + ' vRd,c = ' + gF(gp.vrdc, 2) + ' MPa · u1 = ' + gF(gp.u1, 0) + ' mm · d = ' + gF(gp.dp, 0) + ' mm' });
      F.h3('Bottom-bar anchorage at the end columns');
      F.table(['Column', 'Required lbd (mm)', 'Available (mm)', 'Status'], D.anchor.map(a => [FL.nm(a.j), gF(a.lbd, 0), gF(a.lav, 0), { t: isOk(a.st) ? 'OK' : 'NOT OK', c: isOk(a.st) ? GREEN : RED, b: true }]), [60, 140, 140, CW - 340], { align: ['c', 'r', 'r', 'l'] });
    }
  }
  function slabSection(F, c, k, n) {
    const code = c.code === 'ACI' ? 'ACI 318-25' : 'Eurocode 2';
    if (c.err) { F.band((c.id || 'Slab') + ' · ' + (KIND_NAME[c.kind] || 'Slab'), 'Slab ' + (k + 1) + ' of ' + n + ' · ' + code, 'NOT OK'); F.para('This slab could not be recomputed for the report: ' + c.err, { color: RED, bold: true }); return; }
    F.band(c.id + ' · ' + typeName(c), 'Slab ' + (k + 1) + ' of ' + n + ' · design code: ' + code, c.status);
    const plan = planSvgOf(c) || (c.kind === 'one' && !c.R.ms ? spanSketchSvg(c) : null);
    if (plan) F.fig(plan, { w: 400, title: 'Slab layout' });
    F.h2('1 · Design data'); inputBlock(F, c);
    F.h2('2 · Results'); resultsBlock(F, c);
    F.h2('3 · Calculation steps · ' + code);
    F.para('Every analysis and design step of the ' + code + ' route, with the numbers substituted.', { size: 8, color: MUT, after: 5 });
    F.steps(c.steps);
    diagramsBlock(F, c);
    detailBlock(F, c);
  }
  function cover(F, items, opts, dateStr) {
    const doc = F.doc, n = items.length, ok = items.filter(c => c.status === 'OK').length, codes = Array.from(new Set(items.map(c => c.code === 'ACI' ? 'ACI 318-25' : 'Eurocode 2')));
    doc.rect(0, 0, PW, 150, { fill: '#10231B' }); doc.rect(0, 150, PW, 4, { fill: '#12C26B' });
    doc.text(M, 62, 'SlabLab', { size: 30, bold: true, color: '#FFFFFF' }); doc.text(M, 84, 'Slab design report · calculations, diagrams and detailing', { size: 10.5, color: '#7FE0F0' });
    const t = wrap(opts.title || 'Project', CW, 17, true)[0]; doc.text(M, 124, t, { size: 17, bold: true, color: '#FFFFFF' });
    F.setY(176);
    F.kv([['Date', dateStr], ['Slabs in this report', n], ['Design code' + (codes.length > 1 ? 's' : ''), codes.join(' · ')]], { cols: 3 });
    F.ensure(40); const all = ok === n; doc.rrect(M, F.y(), CW, 30, 8, { fill: all ? '#E4F8EE' : '#FDE8E8' }); doc.text(M + 14, F.y() + 19.5, all ? (n === 1 ? 'The slab passed all checks' : 'All ' + n + ' slabs passed all checks') : ok + ' slab' + (ok === 1 ? '' : 's') + ' out of ' + n + ' passed all checks', { size: 11, bold: true, color: all ? GREEN : RED }); F.gap(40);
    F.h2('Summary');
    F.table(['Slab', 'Type', 'Code', 'Reinforcement', 'Status'], items.map(c => [{ t: c.id || '-', b: true }, c.err ? (KIND_NAME[c.kind] || '') : typeName(c), c.code === 'ACI' ? 'ACI' : 'EC2', c.err ? c.err : summaryRows(c).map(r => r[0] + ': ' + r[1]).join('\n'), { t: c.status === 'OK' ? 'OK' : 'NOT OK', c: c.status === 'OK' ? GREEN : RED, b: true }]), [52, 118, 34, CW - 52 - 118 - 34 - 56, 56], { size: 7.6, align: ['l', 'l', 'c', 'l', 'c'] });
    /* layouts of the two-way and irregular slabs */
    const plans = items.map(c => c.err ? null : ({ c, svg: planSvgOf(c) })).filter(p => p && p.svg);
    if (plans.length) {
      F.h2('Slab layouts · two-way and irregular slabs');
      for (let i = 0; i < plans.length; i += 2) {
        const pair = plans.slice(i, i + 2), w = (CW - 10) / 2, h = 214 * w / 360 + 8; F.ensure(h + 6);
        pair.forEach((p, q) => { const x = M + q * (w + 10); doc.rrect(x - 2, F.y() - 2, w + 4, h - 4, 4, { fill: '#FFFFFF', stroke: '#DCE5E1', lw: 0.6 }); drawSvg(doc, p.svg, x, F.y(), w); });
        F.gap(h + 4);
      }
    }
  }
  function build(recs, opts) {
    opts = opts || {}; if (!recs || !recs.length) throw new Error('No slabs to export');
    const doc = Doc(), d = new Date(), p2 = n => String(n).padStart(2, '0'), dateStr = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
    doc.page(); const F = Flow(doc, opts.title, dateStr), items = recs.map(r => compute(r, opts.cons));
    cover(F, items, opts, dateStr);
    items.forEach((c, k) => { F.newPage(); slabSection(F, c, k, items.length); });
    const N = doc.count();
    for (let pg = 0; pg < N; pg++) {
      doc.use(pg);
      if (pg > 0) { doc.text(M, 34, 'SlabLab · ' + wrap(opts.title || 'Project report', CW - 120, 8.5, true)[0], { size: 8.5, bold: true, color: GREEN }); doc.text(PW - M, 34, dateStr, { size: 8, color: MUT, align: 'r' }); doc.line(M, 41, PW - M, 41, { color: '#BFD3CB', lw: 0.7 }); }
      doc.line(M, PH - 36, PW - M, PH - 36, { color: '#D3DEDA', lw: 0.6 });
      doc.text(M, PH - 24, 'Educational tool: results are for learning and preliminary checks only. Verify independently before any design use.', { size: 6.8, color: MUT });
      doc.text(PW - M, PH - 24, 'Page ' + (pg + 1) + ' / ' + N, { size: 8, bold: true, color: INK, align: 'r' });
    }
    return doc.build({ title: opts.title });
  }

  /* ================================================================ 7 · save / share (offline) ================================================================ */
  function fileName(title) { const s = String(title || 'project').replace(/[^\w\-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'project', d = new Date(), p = n => String(n).padStart(2, '0'); return 'SlabLab_' + s + '_' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '.pdf'; }
  function save(bytes, name) {
    const blob = new Blob([bytes], { type: 'application/pdf' }), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; a.style.display = 'none'; document.body.appendChild(a); a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 60000);
  }
  async function share(bytes, name, title) {
    const file = new File([bytes], name, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: title || name, text: title || name }); return 'shared'; } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; } }
    save(bytes, name); return 'downloaded';
  }

  const API = { build, compute, save, share, fileName, drawSvg, _Doc: Doc, _textW: textW, _runs: runs };
  if (typeof module !== 'undefined') module.exports = API; else root.SL_REPORT = API;
})(typeof window !== 'undefined' ? window : globalThis);
