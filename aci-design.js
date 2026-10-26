/* SlabLab – ACI 318-25 slab design (SI: mm, N/mm², kN, kNm).
   One-way slabs (ACI 7, 6.5), two-way / irregular slabs (ACI 8), flat slabs with the equivalent frame method (ACI 8.11) and
   punching shear with moment transfer (ACI 8.4.4, 22.6).  Exposes SL_ACID.
   Clause numbers refer to ACI CODE-318-25.  Educational tool: verify every result independently before use. */
(function (root) {
  'use strict';
  const PI = Math.PI;
  const f = (x, n) => { if (!isFinite(x)) return '–'; const s = (+x).toFixed(n); return s.indexOf('.') >= 0 ? s.replace(/0+$/, '').replace(/\.$/, '') : s; };
  const nm = j => String.fromCharCode(65 + (j % 26));
  const okS = s => typeof s === 'string' && /^OK/.test(s);
  const GRN = '#12C26B', CY = '#0DAFCB', AMB = '#F5A524';

  /* ------------------------------------------------------------------ materials, loads */
  function mat(c) {
    const fc = +c.fck, fy = +c.fyk, b1 = fc <= 28 ? 0.85 : (fc >= 55 ? 0.65 : 0.85 - 0.05 * (fc - 28) / 7);
    return { fc, fy, sfc: Math.min(Math.sqrt(fc), 8.3), Ec: 4700 * Math.sqrt(fc), Es: 200000, b1, ety: fy / 200000, fr: 0.62 * Math.sqrt(fc), phiV: 0.75, fyt: Math.min(fy, 420) };
  }
  const factors = c => ({ gD: +c.aciGD > 0 ? +c.aciGD : 1.2, gL: +c.aciGL >= 0 && c.aciGL !== undefined && c.aciGL !== '' ? +c.aciGL : 1.6 });
  // ACI 5.3.1: U = 1.4D ; 1.2D + 1.6L  (no roof, snow, rain or lateral loads)
  function Uload(c, Gk, Qk) { const k = factors(c); return { U: Math.max(1.4 * Gk, k.gD * Gk + k.gL * Qk), k, comb: 1.4 * Gk >= k.gD * Gk + k.gL * Qk ? '1.4D' : k.gD + 'D + ' + k.gL + 'L' }; }

  /* ------------------------------------------------------------------ flexure of a 1 m (or b mm) strip */
  function smaxOf(mode, h, c, m) {
    if (mode === 'one') { const fs = 2 / 3 * m.fy, s1 = 380 * 280 / fs - 2.5 * c.cover, s2 = 300 * 280 / fs; return { crack: Math.min(s1, s2), all: Math.min(s1, s2, 3 * h, 450), txt: 'min[380(280/fs) − 2.5cc ; 300(280/fs) ; 3h ; 450], fs = 2/3·fy' }; }
    return { crack: Math.min(2 * h, 450), all: Math.min(2 * h, 450), txt: 'min(2h ; 450) at critical sections (ACI 8.7.2.2)' };
  }
  function flexZ(Mu, h, c, m, phi0, layer, mode, bw) {
    const b = bw || 1000, list = [phi0, 12, 14, 16, 20, 25].filter((v, i, a) => v >= phi0 && a.indexOf(v) === i).sort((a, z) => a - z);
    let z; for (const ph of list) { z = trial(ph); if (z.s >= 100) break; } return z;
    function trial(ph) {
      const Ab = PI / 4 * ph * ph, d = h - c.cover - (layer === 'inner' ? 1.5 : 0.5) * ph;
      const cmax = 0.003 * d / (0.006 + m.ety), amax = m.b1 * cmax, Mmax = 0.9 * 0.85 * m.fc * b * amax * (d - amax / 2) / 1e6, kOk = Mu <= Mmax + 1e-9;
      const arg = 1 - 2 * Mu * 1e6 / (0.9 * 0.85 * m.fc * b * d * d), Asr = arg >= 0 ? 0.85 * m.fc * b * d / m.fy * (1 - Math.sqrt(arg)) : 0.85 * m.fc * b * amax / m.fy;
      const Asmin = 0.0018 * b * h, Asu = Math.max(Asr, Asmin), sm = smaxOf(mode, h, c, m), sC = Math.floor(sm.all / 25) * 25;
      const s = Math.max(0, Math.min(sC, Math.floor(1000 * Ab * (b / 1000) / Asu / 25) * 25)), Asp = s > 0 ? 1000 * Ab * (b / 1000) / s : 0;
      const a = Asp * m.fy / (0.85 * m.fc * b), cn = a / m.b1, et = cn > 0 ? 0.003 * (d - cn) / cn : 1, tc = et >= m.ety + 0.003 - 1e-9;
      const phi = tc ? 0.9 : (et <= m.ety ? 0.65 : 0.65 + 0.25 * (et - m.ety) / 0.003), phiMn = phi * Asp * m.fy * (d - a / 2) / 1e6;
      const flex = !kOk ? 'NOT OK (Mu = ' + f(Mu, 1) + ' > φMn,max = ' + f(Mmax, 1) + ' kNm/m for a tension-controlled section: increase h)' : (!tc ? 'NOT OK (εt = ' + f(et, 4) + ' < εty + 0.003: not tension-controlled, ACI 7.3.3.1 / 8.3.3.1)' : (phiMn + 1e-9 >= Mu ? 'OK' : 'NOT OK (φMn < Mu)'));
      const minS = Math.max(75, ph + Math.max(25, ph)), spac = s >= minS && s <= sm.all + 1e-9 ? 'OK' : 'NOT OK (spacing ' + s + ' mm outside ' + minS + '…' + f(sm.all, 0) + ' mm)';
      const crack = mode === 'one' ? (s <= sm.crack + 1e-9 ? 'OK (ACI 24.3.2: s ≤ ' + f(sm.crack, 0) + ' mm)' : 'NOT OK (ACI 24.3.2: s = ' + s + ' > ' + f(sm.crack, 0) + ' mm)') : (s <= sm.all + 1e-9 ? 'OK (ACI 8.7.2.2: s ≤ ' + f(sm.all, 0) + ' mm)' : 'NOT OK (ACI 8.7.2.2: s = ' + s + ' > ' + f(sm.all, 0) + ' mm)');
      return { Mu, h, d, ph, b, Asr, Asmin, Asu, Asp, s, smax: sm.all, scrack: sm.crack, smTxt: sm.txt, a, et, tc, phi, Mmax, phiMn, txt: 'Ø' + ph + '@' + s, flex, spac, crack };
    }
  }
  function spacingFor(Ar, ph, h, cap) { const Ab = PI / 4 * ph * ph; return Math.max(25, Math.min(Math.floor(1000 * Ab / Ar / 25) * 25, Math.floor(cap / 25) * 25)); }

  /* ------------------------------------------------------------------ shear, development */
  function lamS(d) { return Math.min(1, Math.sqrt(2 / (1 + d / 250))); }
  // ACI 22.5.5.1 (c) with 22.5.5.1.1 limits, no shear reinforcement, no axial load. Returns kN for width b.
  function Vc1(As, b, d, m) {
    const ls = lamS(d), rho = Math.min(1, As / (b * d)), v = 0.66 * ls * Math.pow(rho, 1 / 3) * m.sfc, lo = 0.083 * m.sfc, hi = 0.42 * m.sfc;
    return { ls, rho, v, vc: Math.min(hi, Math.max(v, lo)), Vc: Math.min(hi, Math.max(v, lo)) * b * d / 1e3, lo, hi, Vmax: (Math.min(hi, Math.max(v, lo)) + 0.66 * m.sfc) * b * d / 1e3 };
  }
  // ACI 25.4.2.3 (Table), SI. top = casting position factor
  function ldT(ph, s, c, m, h, top) {
    const psit = (top && (h - c.cover - ph) > 300) ? 1.3 : 1, psig = m.fy <= 420 ? 1 : (m.fy <= 550 ? 1.15 : 1.3), good = (s - ph) >= 2 * ph && c.cover >= ph;
    const den = ph <= 19 ? (good ? 2.1 : 1.4) : (good ? 1.7 : 1.1);
    return { psit, psig, den, good, ld: Math.max(m.fy * psit * psig / (den * m.sfc) * ph, 300) };
  }
  // ACI 25.4.3.1 standard hook (psi_e = 1, psi_cc = psi_r = 1, psi_s = 0.8 for db <= 36 mm), bar stress factor k (1.25 at exterior supports 8.7.4.2.2)
  const ldh = (ph, m, k) => Math.max(k * m.fy * 0.8 / (21 * m.sfc) * ph, 8 * ph, 150);

  /* ------------------------------------------------------------------ deflection helpers */
  function Ie(Ma, As, b, h, d, m) {
    const Ig = b * h ** 3 / 12, Mcr = m.fr * Ig / (h / 2) / 1e6, n = m.Es / m.Ec, nA = n * As, kd = (-nA + Math.sqrt(nA * nA + 2 * b * nA * d)) / b, Icr = b * kd ** 3 / 3 + nA * (d - kd) ** 2;
    const ie = Ma <= 2 / 3 * Mcr ? Ig : Icr / (1 - Math.pow(2 / 3 * Mcr / Ma, 2) * (1 - Icr / Ig));
    return { Ig, Mcr, Icr, Ie: Math.min(ie, Ig) };
  }
  function deltaOf(kind, L, Mmid, Msup, EcIe) { // mm; L mm, moments kNm
    const M1 = Mmid * 1e6, M2 = Msup * 1e6;
    if (kind === 'cant') return M2 * L * L / (4 * EcIe);
    return 5 * L * L / (48 * EcIe) * (M1 - (kind === 'ss' ? 0 : (kind === 'one' ? 0.1 * M2 : 0.1 * 2 * M2)));
  }
  function deflCalc(o) {   // o: {kind, L, Ms, Mh, Gk, Qk, U, As, b, h, d, m}
    const sv = (o.Gk + o.Qk) / o.U, sd = o.Gk / o.U, E = o.m.Ec;
    const a1 = Ie(Math.max(o.Ms, o.Mh) * sv, o.As, o.b, o.h, o.d, o.m), a2 = Ie(Math.max(o.Ms, o.Mh) * sd, o.As, o.b, o.h, o.d, o.m);
    const dDL = deltaOf(o.kind, o.L, o.Ms * sv, o.Mh * sv, E * a1.Ie), dD = deltaOf(o.kind, o.L, o.Ms * sd, o.Mh * sd, E * a2.Ie), dL = Math.max(0, dDL - dD), lam = 2, dTot = lam * dD + dL;
    const lim1 = o.L / 360, lim2 = o.L / 240;
    return { Ie1: a1, dDL, dD, dL, lam, dTot, lim1, lim2, st: dL <= lim1 && dTot <= lim2 ? 'OK (calculated: Δ(L) = ' + f(dL, 1) + ' ≤ ℓ/360 = ' + f(lim1, 1) + ' mm ; λΔ·ΔD + ΔL = ' + f(dTot, 1) + ' ≤ ℓ/240 = ' + f(lim2, 1) + ' mm)' : 'NOT OK (calculated: Δ(L) = ' + f(dL, 1) + ' mm vs ℓ/360 = ' + f(lim1, 1) + ' ; λΔ·ΔD + ΔL = ' + f(dTot, 1) + ' mm vs ℓ/240 = ' + f(lim2, 1) + ')' };
  }

  /* =================================================================== ONE-WAY SLABS */
  function oneWay(R, c) {
    const E = root.SL || require('./engine.js'), m = mat(c), inp = R.inp, h = R.h, b = 1000, ph = c.phi, d = h - c.cover - ph / 2, Gk = R.ld.Gk, Qk = R.ld.Qk;
    const UL = Uload(c, Gk, Qk), U = UL.U, bwv = (inp.bw === '' || inp.bw == null) ? null : (+inp.bw > 0 ? +inp.bw : null), L = R.L, Lm = L / 1000, cu = R.cu;
    const ln = (bwv ? L - bwv : L) / 1000, ncl = [];
    let Ms = 0, Mh = 0, V = 0, wd = U, method = '', vOff = d / 1000, cv = null, kindD = 'ss', ctrl = [];
    if (R.ms) {
      const q = inp, n0 = E.loads(c, h, +q.addG || 0, (q.qov === '' || q.qov == null) ? null : +q.qov).n, sc = U / n0;
      const sp = q.sp.map(x => ({ L: +x.L / 1000, w: (x.w === '' || x.w == null || !isFinite(+x.w)) ? U : +x.w * sc }));
      const ms = E.multiSpan(sp, q.el || 'Pinned', q.er || 'Pinned'), k = R.msK, S0 = ms.spans[k];
      Ms = S0.Ms; Mh = Math.max(ms.Mhog[k], ms.Mhog[k + 1]); V = Math.max(Math.abs(S0.VA), Math.abs(S0.VB)); wd = sp[k].w; vOff = ((bwv ? bwv / 2 : 0) + d) / 1000;
      const lc = k > 0 || q.el === 'Fixed', rc = k < sp.length - 1 || q.er === 'Fixed'; kindD = lc && rc ? 'both' : (lc || rc ? 'one' : 'ss'); ctrl = [lc, rc];
      method = 'Elastic continuous strip (' + sp.length + ' spans, loads as entered × γ-ratio, no pattern loading); design span ' + (k + 1);
      R._aciMs = ms;
    } else {
      method = 'ACI 6.5 simplified method (Table 6.5.2 moments, Table 6.5.4 shears), ℓn = ' + f(ln, 3) + ' m' + (bwv ? ' (L − bw)' : ' (no beam width entered: ℓn = L)');
      const Ll = +inp.Ll || 0, Lr = +inp.Lr || 0, two = +inp.spanCount === 2;
      if (cu === 'Simply supported') { Ms = U * Lm * Lm / 8; V = U * ln / 2; kindD = 'ss'; }
      else if (cu === 'Cantilever') { Mh = U * Lm * Lm / 2; V = U * Lm; kindD = 'cant'; vOff = d / 1000; }
      else {
        if (cu === 'End span') { Ms = U * ln * ln / 11; Mh = U * ln * ln / (two ? 9 : 10); kindD = 'one'; } else { Ms = U * ln * ln / 16; Mh = U * ln * ln / 11; kindD = 'both'; }
        V = 1.15 * U * ln / 2;
        const bad = [];
        if (!(Number.isInteger(+inp.spanCount) && +inp.spanCount >= 2)) bad.push('enter the total number of spans (≥ 2)');
        if (!(Ll > 0 || Lr > 0)) bad.push('enter at least one adjacent span (longer ≤ 1.2 × shorter)');
        [Ll, Lr].forEach(x => { if (x > 0 && Math.max(x, L) / Math.min(x, L) > 1.2) bad.push('adjacent spans differ by more than 20 %'); });
        if (Qk > 3 * Gk) bad.push('L > 3D');
        cv = bad.length ? 'NOT OK (ACI 6.5.1: ' + bad.join('; ') + ')' : 'OK (ACI 6.5.1 conditions satisfied by the data entered: prismatic, uniform load, L ≤ 3D, ≥ 2 spans, adjacent spans within 20 %)';
      }
    }
    const fs = Ms > 1e-9 ? flexZ(Ms, h, c, m, ph, 'outer', 'one') : null, fh = Mh > 1e-9 ? flexZ(Mh, h, c, m, ph, 'outer', 'one') : null;
    const Am = fs ? fs.Asp : (fh ? fh.Asp : 0), Ash = 0.0018 * b * h, sS = spacingFor(Ash, ph, h, Math.min(5 * h, 450)), sec = { As: Ash, s: sS, txt: 'Ø' + ph + '@' + sS };
    // shear
    const As1 = Math.max((c.frac > 0 ? c.frac : 0.5) * (fs ? fs.Asp : 0), fh ? fh.Asp : 0), vc = Vc1(As1, b, d, m);
    const Vu = Math.max(0, V - wd * vOff), Vface = Math.max(0, V - (R.ms && bwv ? wd * bwv / 2000 : 0)), phiVc = m.phiV * vc.Vc;
    const shear = { d, As1, ...vc, Vu, Vface, phiVc, phiVmax: m.phiV * vc.Vmax, wd, vOff, noBeam: !bwv && !!R.ms };
    shear.st = Vu <= phiVc + 1e-9 ? (Vface <= shear.phiVmax + 1e-9 ? 'OK' : 'NOT OK (Vu at the face > φ(Vc + 0.66√f′c·bw·d), ACI 22.5.1.2)') : 'NOT OK (Vu = ' + f(Vu, 1) + ' kN/m > φVc = ' + f(phiVc, 1) + ' kN/m: increase h; shear reinforcement in a slab is not designed here)';
    if (shear.noBeam && okS(shear.st)) shear.st = 'OK (conservative: Vu taken at d from the support centre-line because no support width was entered)';
    // minimum thickness / deflection
    const den = { ss: 20, one: 24, both: 28, cant: 10 }[kindD], kfy = 0.4 + m.fy / 700, hmin = L / den * kfy;
    let defl = { hmin, den, kfy, kind: kindD, calc: null };
    if (h + 1e-9 >= hmin) defl.st = 'OK (ACI Table 7.3.1.1: h = ' + h + ' ≥ ℓ/' + den + '·(0.4 + fy/700) = ' + f(hmin, 0) + ' mm; calculated deflection not required)';
    else if (fs || fh) { const As = fs ? fs.Asp : fh.Asp; defl.calc = deflCalc({ kind: kindD, L, Ms, Mh, Gk, Qk, U, As, b, h, d, m }); defl.st = defl.calc.st; } else defl.st = 'NOT OK (no reinforcement for deflection)';
    // development / support anchorage
    const items = []; let ancSt;
    if (cu === 'Cantilever' && !R.ms) { const t = fh ? ldT(fh.ph, fh.s, c, m, h, true) : null; if (t) items.push({ label: 'top bars into the support', ld: t.ld, hk: ldh(fh.ph, m, 1), lav: bwv ? bwv - c.cover : null, full: true }); }
    else if (fs) {
      const cont = kindD === 'both', fr = cont ? 0.25 : 1 / 3, sSup = fs.s / fr, t = ldT(fs.ph, sSup, c, m, h, false), AsS = fr * fs.Asp, a = AsS * m.fy / (0.85 * m.fc * b), Mn = AsS * m.fy * (d - a / 2) / 1e6, la = bwv ? bwv / 2 - c.cover : null;
      items.push({ label: 'bottom bars at the support (≥ ' + (cont ? '1/4' : '1/3') + ' of As+)', ld: t.ld, hk: ldh(fs.ph, m, 1), Mn, V, la, lim: la != null ? 1.3 * Mn * 1e3 / V + la : null, fr });
    }
    if (!items.length) ancSt = 'NOT OK (no reinforcement available for the anchorage check)';
    else if (!bwv) ancSt = 'NOT OK (support beam width not entered: the embedment available at the support cannot be checked)';
    else { const bad = items.filter(x => x.full ? x.ld > x.lav + 1e-9 && x.hk > x.lav + 1e-9 : x.ld > x.lim + 1e-9); ancSt = bad.length ? 'NOT OK (' + bad.map(x => x.label + ': ℓd = ' + f(x.ld, 0) + ' mm exceeds the length available — use a smaller bar, a hook or a wider support').join('; ') + ')' : 'OK (ACI 25.4.2 / 9.7.3.8.3: ℓd ≤ 1.3Mn/Vu + ℓa ; top cantilever bars ℓd ≤ available length)'; }
    const lapB = fs ? 1.3 * ldT(fs.ph, fs.s, c, m, h, false).ld : 0;
    const flexOk = (!Ms || (fs && okS(fs.flex))) && (!Mh || (fh && okS(fh.flex))) && (fs || fh), crOk = [fs, fh].filter(Boolean).every(z => okS(z.crack)), spOk = [fs, fh].filter(Boolean).every(z => okS(z.spac)) && sS >= 75;
    const st = { flex: flexOk ? 'OK' : (fs || fh ? [fs, fh].filter(Boolean).map(z => z.flex).find(x => !okS(x)) : 'NOT OK (no moment)'), spacing: spOk ? 'OK' : 'NOT OK (bar spacing outside the allowed range)', crack: crOk ? 'OK' : [fs, fh].filter(Boolean).map(z => z.crack).find(x => !okS(x)), shear: shear.st, defl: defl.st, anchorage: ancSt };
    if (cv) st.an = cv;
    st.overall = Object.keys(st).every(k => okS(st[k])) ? 'OK' : 'NOT OK';
    const keys = [['flex', 'Flexure'], ['spacing', 'Spacing'], ['crack', 'Crack control'], ['shear', 'Shear'], ['defl', 'Deflection'], ['anchorage', 'Anchorage']].concat(cv ? [['an', 'ACI 6.5.1 conditions']] : []);
    const bars = []; if (fs) bars.push(['Bottom bars (sagging)', fs.txt + ' C/C · As = ' + f(fs.Asp, 0) + ' mm²/m', GRN]); if (fh) bars.push(['Top bars (support)', fh.txt + ' C/C · As = ' + f(fh.Asp, 0) + ' mm²/m', GRN]);
    bars.push(['Distribution / shrinkage bars', sec.txt + ' C/C (0.0018·Ag)', CY]);
    const res = { code: 'ACI', kind: 'one', title: S_id(inp) + ' · ACI 318-25', sub: 'One-way · ' + (R.ms ? 'continuous strip' : cu) + ' · L = ' + L + ' mm', R, c, m, U, UL, Ms, Mh, V, fs, fh, sec, shear, defl, items, st, keys, bars, method, lapB,
      metrics: [['M⁺ Mu', f(Ms, 2), 'kNm/m'], ['M⁻ Mu', f(Mh, 2), 'kNm/m'], ['Vu', f(V, 2), 'kN/m']], notes: ['ACI load combination: ' + UL.comb + ' → wu = ' + f(U, 2) + ' kN/m² (EC2 route uses 1.35Gk + 1.5Qk).'] };
    res.steps = oneWaySteps(res); res.summary = bars.map(x => [x[0], x[1]]); return res;
  }
  const S_id = i => i.id || 'Slab';

  function oneWaySteps(r) {
    const { c, m, R } = r, L = [], T = (t, rows) => L.push({ t, r: rows }), fs = r.fs, fh = r.fh;
    T('1 · Materials & load combination (ACI 5.3.1, 19, 20)', [['Concrete / steel', 'f′c · fy', c.fck + ' · ' + c.fyk + ' MPa'], ['β1 · Ec = 4700√f′c', 'Table 22.2.2.4.3', f(m.b1, 3) + ' · ' + f(m.Ec, 0) + ' MPa'], ['Service load', 'D = Gk · L = Qk', f(R.ld.Gk, 3) + ' · ' + f(R.ld.Qk, 2) + ' kN/m²'], ['Factored load', 'U = max(1.4D ; ' + r.UL.k.gD + 'D + ' + r.UL.k.gL + 'L)', f(r.U, 3) + ' kN/m² (' + r.UL.comb + ')', 1]]);
    T('2 · Analysis (per 1 m strip)', [['Method', '', r.method], ['Mu sagging', '', f(r.Ms, 3) + ' kNm/m'], ['Mu hogging', '', f(r.Mh, 3) + ' kNm/m'], ['Vu (support)', '', f(r.V, 3) + ' kN/m', 1]].concat(r.st.an ? [['ACI 6.5.1 conditions', 'prismatic · uniform · L ≤ 3D · ≥ 2 spans · ±20 %', r.st.an, okS(r.st.an) ? 0 : 1]] : []));
    [[fs, 'Flexure · sagging'], [fh, 'Flexure · hogging']].forEach(([z, t]) => { if (!z) return; T('3 · ' + t + ' (ACI 22.3, 7.6.1, 7.7.2)', [['Effective depth', 'd = h − cover − Ø/2', f(z.d, 1) + ' mm'], ['Required area', 'As = (0.85f′c·b·d/fy)[1 − √(1 − 2Mu/(φ·0.85f′c·b·d²))], φ = 0.9', f(z.Asr, 0) + ' mm²/m'], ['Minimum area', 'As,min = 0.0018·Ag (7.6.1.1)', f(z.Asmin, 0) + ' mm²/m' + (z.Asmin > z.Asr ? '  ← governs' : '')], ['Maximum spacing', z.smTxt, f(z.smax, 0) + ' mm'], ['Provided', 'Ø' + z.ph, z.txt + ' → As = ' + f(z.Asp, 0) + ' mm²/m', 1], ['Strain / φ', 'a = As·fy/(0.85f′c·b) ; εt = 0.003(d − c)/c', 'εt = ' + f(z.et, 4) + (z.tc ? ' ≥ εty + 0.003 → φ = 0.9' : ' → φ = ' + f(z.phi, 3))], ['Strength', 'φMn = φ·As·fy(d − a/2)', f(z.phiMn, 2) + ' kNm/m ' + (z.phiMn >= z.Mu ? '≥' : '<') + ' ' + f(z.Mu, 2), 1], ['Crack control (24.3.2)', 's ≤ min[380(280/fs) − 2.5cc ; 300(280/fs)]', z.crack]]); });
    const s = r.shear;
    T('4 · One-way shear (ACI 22.5.5.1, 7.4.3.2)', [['Size effect', 'λs = √(2/(1 + d/250)) ≤ 1', f(s.ls, 3)], ['Steel ratio', 'ρw = As/(b·d), As = ' + f(s.As1, 0) + ' mm²/m', f(s.rho * 100, 3) + ' %'], ['Vc', '0.66λs·ρw^(1/3)·√f′c·b·d (0.083√f′c·b·d ≤ Vc ≤ 0.42√f′c·b·d)', f(s.Vc, 1) + ' kN/m'], ['Design shear at d from the support face', 'Vu = V − wu·x', f(s.Vu, 2) + ' kN/m'], ['Check', 'φ = 0.75 : Vu ≤ φVc', f(s.Vu, 2) + ' ' + (s.Vu <= s.phiVc ? '≤' : '>') + ' ' + f(s.phiVc, 2) + ' → ' + (okS(s.st) ? 'OK' : 'NOT OK'), 1]]);
    const d = r.defl;
    T('5 · Deflection (ACI 7.3.1, 24.2)', [['Minimum thickness', 'h ≥ ℓ/' + d.den + ' × (0.4 + fy/700)', f(d.hmin, 0) + ' mm (provided ' + R.h + ')'], ['Status', '', d.st, 1]].concat(d.calc ? [['Immediate Δ', 'Ie (Table 24.2.3.5), midspan, 5ℓ²/48EcIe·[Mmid − 0.1ΣMend]', 'ΔD+L = ' + f(d.calc.dDL, 2) + ' · ΔD = ' + f(d.calc.dD, 2) + ' · ΔL = ' + f(d.calc.dL, 2) + ' mm'], ['Long-term', 'λΔ = ξ/(1 + 50ρ′) = 2.0 (≥ 5 years, ρ′ = 0)', 'λΔ·ΔD + ΔL = ' + f(d.calc.dTot, 2) + ' mm']] : []));
    T('6 · Distribution reinforcement', [['Minimum', 'As = 0.0018·Ag (24.4.3.2), s ≤ min(5h ; 450)', r.sec.txt + ' C/C']]);
    T('7 · Development & support anchorage (ACI 25.4.2, 25.4.3, 7.7.3.8)', r.items.map(x => x.full ? [x.label, 'ℓd = fy·ψt·ψg/(' + 'k·λ√f′c)·db ≥ 300 ; available = bw − cover', 'ℓd = ' + f(x.ld, 0) + ' mm · hook ℓdh = ' + f(x.hk, 0) + ' · available ' + (x.lav == null ? '—' : f(x.lav, 0)) + ' mm'] : [x.label, 'ℓd ≤ 1.3Mn/Vu + ℓa', 'ℓd = ' + f(x.ld, 0) + ' mm ; Mn = ' + f(x.Mn, 2) + ' kNm/m ; limit = ' + (x.lim == null ? '—' : f(x.lim, 0)) + ' mm']).concat([['Lap splice (Class B)', 'ℓst = max(1.3ℓd ; 300)', f(Math.max(r.lapB, 300), 0) + ' mm'], ['Status', '', r.st.anchorage, 1]]));
    T('8 · Summary of checks', r.keys.map(k => [k[1], '', r.st[k[0]], okS(r.st[k[0]]) ? 0 : 1]).concat([['Overall', '', r.st.overall, 1]]));
    return L;
  }

  /* =================================================================== TWO-WAY / IRREGULAR */
  function alphaF(bw, hb, h, lxs, lys, c, m) { // ACI 8.10.2.? T-beam: flange each side = min(hb − h, 4h)
    const be = bw + 2 * Math.min(Math.max(hb - h, 0), 4 * h), A1 = bw * hb, A2 = (be - bw) * h, y1 = hb / 2, y2 = hb - h / 2, yc = (A1 * y1 + A2 * y2) / (A1 + A2);
    const Ib = bw * hb ** 3 / 12 + A1 * (y1 - yc) ** 2 + (be - bw) * h ** 3 / 12 + A2 * (y2 - yc) ** 2, Is1 = lxs * h ** 3 / 12, Is2 = lys * h ** 3 / 12;
    const a1 = Ib / Is1, a2 = Ib / Is2; return { Ib, a1, a2, am: (2 * a1 + 2 * a2) / 4 };
  }
  function minTh2(R, c, m) {
    const inp = R.inp, bw = (inp.bw === '' || inp.bw == null) ? 0 : +inp.bw, hb = (inp.hb === '' || inp.hb == null) ? 0 : +inp.hb, lx = R.lxs, ly = R.lys, h = R.h, ratio = ly / lx, edge = R.cn > 1;
    const lnl = ly - bw, lns = lx - bw, be = lnl / lns;
    if (bw > 0 && hb > h) {
      const a = alphaF(bw, hb, h, lx, ly, c, m);
      let hm, eq;
      if (a.am <= 0.2) return fallback(false);
      if (a.am <= 2) { const h1 = lnl * (0.8 + m.fy / 1400) / (36 + 5 * be * (a.am - 0.2)); hm = Math.max(h1, 125); eq = 'Table 8.3.1.2 (b): ℓn(0.8 + fy/1400)/(36 + 5β(αfm − 0.2)) ≥ 125'; }
      else { const h1 = lnl * (0.8 + m.fy / 1400) / (36 + 9 * be); hm = Math.max(h1, 90); eq = 'Table 8.3.1.2 (d): ℓn(0.8 + fy/1400)/(36 + 9β) ≥ 90'; }
      if (edge) hm *= 1.1;
      return { hm, eq: eq + (edge ? ' ; ×1.10 for a discontinuous edge (8.3.1.2.1)' : ''), a, ratio, lnl };
    }
    return fallback(true);
    function fallback(noBeam) {
      const t = { 280: edge ? 33 : 36, 420: edge ? 30 : 33, 550: edge ? 27 : 30 }, fy = Math.min(550, Math.max(280, m.fy));
      const den = fy <= 420 ? t[280] + (t[420] - t[280]) * (fy - 280) / 140 : t[420] + (t[550] - t[420]) * (fy - 420) / 130;
      return { hm: Math.max(lnl / den, 125), eq: 'Table 8.3.1.1 (' + (edge ? 'exterior' : 'interior') + ' panel, no drop panel): ℓn/' + f(den, 1) + ' ≥ 125 mm' + (noBeam ? ' — no support beams entered' : ''), a: null, ratio, lnl };
    }
  }
  function twoWay(R, c) {
    const m = mat(c), h = R.h, ph = c.phi, UL = Uload(c, R.ld.Gk, R.ld.Qk), U = UL.U, manual = !!(R.ovr && R.ovr.label === 'Manual (FE)'), s = manual ? 1 : U / R.ld.n;
    const M = { xn: R.M.xn * s, xp: R.M.xp * s, yn: R.M.yn * s, yp: R.M.yp * s }, V = R.V * s, dx = R.dx, dy = R.dy, inp = R.inp, bw = (inp.bw === '' || inp.bw == null) ? null : (+inp.bw > 0 ? +inp.bw : null);
    const fz = (Mu, layer) => Mu > 1e-9 ? flexZ(Mu, h, c, m, ph, layer, 'two') : null;
    const fsx = fz(M.xp, 'outer'), fhx = fz(M.xn, 'outer'), fsy = fz(M.yp, 'inner'), fhy = fz(M.yn, 'inner'), zs = [fsx, fhx, fsy, fhy];
    const Ash = 0.0018 * 1000 * h, ex = (!fhx && fsx) ? { s: spacingFor(Ash, ph, h, Math.min(3 * h, 450)) } : null, ey = (!fhy && fsy) ? { s: spacingFor(Ash, ph, h, Math.min(3 * h, 450)) } : null;
    // one-way shear at d from the support (both directions)
    const shr = (fs, fh, d) => { const As1 = Math.max(0.5 * (fs ? fs.Asp : 0), fh ? fh.Asp : 0), vc = Vc1(As1, 1000, d, m), off = ((bw ? bw / 2 : 0) + d) / 1000, Vu = Math.max(0, V - U * off); return { d, As1, ...vc, Vu, phiVc: m.phiV * vc.Vc, phiVmax: m.phiV * vc.Vmax, Vface: Math.max(0, V - U * (bw ? bw / 2000 : 0)) }; };
    const sx = shr(fsx, fhx, dx), sy = shr(fsy, fhy, dy), gov = sx.Vu / sx.phiVc >= sy.Vu / sy.phiVc ? sx : sy;
    let shSt = sx.Vu <= sx.phiVc + 1e-9 && sy.Vu <= sy.phiVc + 1e-9 ? (Math.max(sx.Vface, sy.Vface) <= Math.min(sx.phiVmax, sy.phiVmax) ? 'OK' : 'NOT OK (face shear > φ(Vc + 0.66√f′c·bw·d))') : 'NOT OK (Vu = ' + f(Math.max(sx.Vu, sy.Vu), 1) + ' kN/m > φVc = ' + f(gov.phiVc, 1) + ' kN/m: increase h)';
    if (!bw && okS(shSt)) shSt = 'OK (conservative: Vu at the support centre-line, no support width entered)';
    // thickness
    const mt = minTh2(R, c, m); let defl = { mt, st: '' };
    if (R.ovr && R.ovr.label !== 'Equivalent Rectangle') defl.st = 'NOT OK (irregular geometry: direct deflection verification required)';
    else if (R.ratio > 2) defl.st = 'NOT OK (ℓy/ℓx > 2: ACI 8.3.2.1(b) requires calculated deflections)';
    else if (h + 1e-9 >= mt.hm) defl.st = 'OK (ACI 8.3.1: h = ' + h + ' ≥ ' + f(mt.hm, 0) + ' mm; calculated deflection not required)';
    else defl.st = 'NOT OK (h = ' + h + ' < ' + f(mt.hm, 0) + ' mm: increase h or verify calculated deflection per ACI 24.2 / 8.3.2)';
    // development & anchorage at the supports
    const items = [];
    [[fsx, 'x bottom bars', dx], [fsy, 'y bottom bars', dy]].forEach(([z, label]) => { if (!z) return; const t = ldT(z.ph, z.s / (1 / 3), c, m, h, false); items.push({ label, ld: t.ld, hk: ldh(z.ph, m, 1), lav: bw ? bw - c.cover : null, ph: z.ph }); });
    let anSt; if (!items.length) anSt = 'NOT OK (no reinforcement available for the anchorage check)'; else if (!bw) anSt = 'NOT OK (support beam width not entered: the embedment available at the support cannot be checked)'; else { const bad = items.filter(x => x.ld > x.lav && x.hk > x.lav); anSt = bad.length ? 'NOT OK (' + bad.map(x => x.label + ': ℓd = ' + f(x.ld, 0) + ' / ℓdh = ' + f(x.hk, 0) + ' mm > ' + f(x.lav, 0) + ' mm available').join('; ') + ')' : 'OK (ACI 25.4.2 / 25.4.3: straight or hooked embedment within the support)'; }
    const tors = (R.cs.cor > 0 && fsx && !(R.ovr && R.ovr.noTors)) ? { cor: R.cs.cor, txt: fsx.txt, len: R.lys / 5 } : null;
    const flexOk = zs.filter(Boolean).length > 0 && zs.every(z => !z || okS(z.flex)) && !!fsx && !!fsy;
    const st = { flex: flexOk ? 'OK' : (zs.filter(Boolean).map(z => z.flex).find(x => !okS(x)) || 'NOT OK (a flexural zone could not be designed)'), spacing: zs.filter(Boolean).every(z => okS(z.spac)) ? 'OK' : 'NOT OK (bar spacing outside the allowed range)', crack: zs.filter(Boolean).every(z => okS(z.crack)) ? 'OK (ACI 8.7.2.2 : s ≤ min(2h ; 450); ACI 24.3.2 applies to one-way slabs and beams)' : zs.filter(Boolean).map(z => z.crack).find(x => !okS(x)), shear: shSt, defl: defl.st, anchorage: anSt };
    if (R.st && R.st.an !== undefined) st.an = R.st.an; if (R.analysisStatus && R.analysisStatus !== undefined && !R.st.an) st.analysis = /^NOT OK/.test(R.analysisStatus) ? R.analysisStatus : 'OK (moments from the Analysis stage, scaled to the ACI factored load)';
    st.overall = Object.keys(st).every(k => okS(st[k])) ? 'OK' : 'NOT OK';
    const keys = [].concat(st.analysis ? [['analysis', 'Analysis']] : [], st.an ? [['an', 'Analysis']] : [], [['flex', 'Flexure'], ['spacing', 'Spacing'], ['crack', 'Crack control'], ['shear', 'Shear'], ['defl', 'Deflection'], ['anchorage', 'Anchorage']]);
    const bars = []; if (fsx) bars.push(['Bottom X (short span)', fsx.txt + ' · ' + f(fsx.Asp, 0) + ' mm²/m', GRN]); if (fsy) bars.push(['Bottom Y (long span)', fsy.txt + ' · ' + f(fsy.Asp, 0) + ' mm²/m', CY]);
    if (fhx) bars.push(['Top X (continuous edges)', fhx.txt, GRN]); else if (ex) bars.push(['Top X (discontinuous edge, nominal 0.0018Ag)', 'Ø' + ph + '@' + ex.s + ' (nominal)', GRN]);
    if (fhy) bars.push(['Top Y (continuous edges)', fhy.txt, CY]); else if (ey) bars.push(['Top Y (discontinuous edge, nominal 0.0018Ag)', 'Ø' + ph + '@' + ey.s + ' (nominal)', CY]);
    if (tors) bars.push(['Corner reinforcement (' + tors.cor + ' corner' + (tors.cor > 1 ? 's' : '') + ', top & bottom, ACI 8.7.3)', tors.txt + ' over ' + f(tors.len, 0) + ' mm', AMB]);
    const irr = R.ovr && R.ovr.label !== 'Equivalent Rectangle';
    const res = { code: 'ACI', kind: R.ovr ? 'irr' : 'two', title: (inp.id || 'Slab') + ' · ACI 318-25', sub: (R.ovr ? 'Irregular · ' + R.ovr.label : 'Two-way · type ' + R.cn) + ' · ' + Math.round(R.lxs) + ' × ' + Math.round(R.lys) + ' mm', R, c, m, U, UL, M, V, s, manual, fsx, fhx, fsy, fhy, ex, ey, sx, sy, shSt, defl, items, tors, st, keys, bars,
      metrics: [['Msx⁺ Mu', f(M.xp, 2), 'kNm/m'], ['Msy⁺ Mu', f(M.yp, 2), 'kNm/m'], ['Vu', f(V, 2), 'kN/m']],
      notes: ['ACI load combination: ' + UL.comb + ' → wu = ' + f(U, 2) + ' kN/m².', manual ? 'Moments entered in Manual (FE) are used as factored moments for the ACI combination.' : 'Panel moments come from the Analysis stage (equilibrium-satisfying coefficient / yield-line moments, linear in the load) scaled by wu(ACI)/n(EC2) = ' + f(s, 3) + ' (ACI 8.2.1 permits any analysis that satisfies equilibrium and compatibility). ACI 8.10 direct design is not used.'] };
    res.steps = twoWaySteps(res); res.summary = bars.map(x => [x[0], x[1]]); return res;
  }
  function twoWaySteps(r) {
    const { c, m, R } = r, L = [], T = (t, rows) => L.push({ t, r: rows });
    T('1 · Materials & load combination (ACI 5.3.1)', [['f′c · fy', 'β1 = ' + f(m.b1, 3), c.fck + ' · ' + c.fyk + ' MPa'], ['Service load', 'D · L', f(R.ld.Gk, 3) + ' · ' + f(R.ld.Qk, 2) + ' kN/m²'], ['Factored load', 'wu = max(1.4D ; ' + r.UL.k.gD + 'D + ' + r.UL.k.gL + 'L)', f(r.U, 3) + ' kN/m² (' + r.UL.comb + ')', 1]]);
    T('2 · Panel moments (per metre)', [['Source', '', r.manual ? 'entered by the user (Manual FE)' : 'Analysis stage × ' + f(r.s, 3)], ['Msx⁻ / Msx⁺', '', f(r.M.xn, 2) + ' / ' + f(r.M.xp, 2) + ' kNm/m'], ['Msy⁻ / Msy⁺', '', f(r.M.yn, 2) + ' / ' + f(r.M.yp, 2) + ' kNm/m'], ['Vu (support)', '', f(r.V, 2) + ' kN/m', 1]]);
    [[r.fsx, 'x · sagging'], [r.fhx, 'x · hogging'], [r.fsy, 'y · sagging'], [r.fhy, 'y · hogging']].forEach(([z, t]) => { if (!z) return; T('3 · Flexure ' + t, [['d', 'h − cover − Ø/2 (y: − Ø more)', f(z.d, 1) + ' mm'], ['As,req', '(0.85f′c·b·d/fy)[1 − √(1 − 2Mu/(φ0.85f′c·b·d²))]', f(z.Asr, 0) + ' mm²/m'], ['As,min', '0.0018·Ag (8.6.1.1)', f(z.Asmin, 0) + ' mm²/m'], ['Spacing limit', z.smTxt, f(z.smax, 0) + ' mm'], ['Provided', '', z.txt + ' → ' + f(z.Asp, 0) + ' mm²/m', 1], ['φMn', 'εt = ' + f(z.et, 4) + ' · φ = ' + f(z.phi, 2), f(z.phiMn, 2) + ' ' + (z.phiMn >= z.Mu ? '≥' : '<') + ' ' + f(z.Mu, 2) + ' kNm/m', 1]]); });
    T('4 · One-way shear at d from the support (ACI 22.5.5.1)', [['x · Vc / φVc', 'λs = ' + f(r.sx.ls, 3) + ' · ρ = ' + f(r.sx.rho * 100, 3) + ' %', f(r.sx.Vc, 1) + ' / ' + f(r.sx.phiVc, 1) + ' kN/m'], ['y · Vc / φVc', 'λs = ' + f(r.sy.ls, 3) + ' · ρ = ' + f(r.sy.rho * 100, 3) + ' %', f(r.sy.Vc, 1) + ' / ' + f(r.sy.phiVc, 1) + ' kN/m'], ['Vu,d (x / y)', 'V − wu·(bw/2 + d)', f(r.sx.Vu, 2) + ' / ' + f(r.sy.Vu, 2) + ' kN/m'], ['Status', '', r.st.shear, 1]]);
    T('5 · Minimum thickness / deflection (ACI 8.3.1)', [['Required h', r.defl.mt.eq, f(r.defl.mt.hm, 0) + ' mm (provided ' + R.h + ')'].concat([])].concat(r.defl.mt.a ? [['αf of the support beams', 'αf = Ecb·Ib/(Ecs·Is), T-beam flanges per 8.4.1.8', 'αf1 = ' + f(r.defl.mt.a.a1, 2) + ' · αf2 = ' + f(r.defl.mt.a.a2, 2) + ' · αfm = ' + f(r.defl.mt.a.am, 2)]] : [], [['Status', '', r.st.defl, 1]]));
    T('6 · Corners, edges, anchorage', [['Corner reinforcement', 'ACI 8.7.3.1: Mu = max positive moment, over ℓlong/5', r.tors ? r.tors.txt + ' top & bottom over ' + f(r.tors.len, 0) + ' mm' : 'not required'], ['Anchorage', 'ℓd (25.4.2) or ℓdh (25.4.3) ≤ bw − cover', r.st.anchorage, 1]]);
    T('7 · Summary of checks', r.keys.map(k => [k[1], '', r.st[k[0]], okS(r.st[k[0]]) ? 0 : 1]).concat([['Overall', '', r.st.overall, 1]]));
    return L;
  }

  /* =================================================================== PUNCHING SHEAR (ACI 22.6 + 8.4.4) */
  function critSec(pos, c1, c2, d) {
    let a, b2, segs, colx, xmin, xmax;
    if (pos === 'Interior') { a = c1 + d; b2 = c2 + d; segs = [{ t: 'x', L: a, xc: 0 }, { t: 'x', L: a, xc: 0 }, { t: 'y', L: b2, xc: -a / 2 }, { t: 'y', L: b2, xc: a / 2 }]; colx = 0; xmin = -a / 2; xmax = a / 2; }
    else if (pos === 'Edge') { a = c1 + d / 2; b2 = c2 + d; segs = [{ t: 'x', L: a, xc: a / 2 }, { t: 'x', L: a, xc: a / 2 }, { t: 'y', L: b2, xc: a }]; colx = c1 / 2; xmin = 0; xmax = a; }
    else { a = c1 + d / 2; b2 = c2 + d / 2; segs = [{ t: 'x', L: a, xc: a / 2 }, { t: 'y', L: b2, xc: a }]; colx = c1 / 2; xmin = 0; xmax = a; }
    const A = segs.reduce((s, q) => s + q.L * d, 0), xb = segs.reduce((s, q) => s + q.L * d * q.xc, 0) / A;
    const J = segs.reduce((s, q) => s + (q.t === 'x' ? d * q.L ** 3 / 12 + q.L * d ** 3 / 12 : 0) + q.L * d * (q.xc - xb) ** 2, 0);
    const b0 = segs.reduce((s, q) => s + q.L, 0), g = pos === 'Interior' ? 0 : xb - colx, cIn = xmax - xb, cOut = xb - xmin;
    return { a, b2, b0, A, xb, J, g, cIn, cOut, area: pos === 'Interior' ? a * b2 : (pos === 'Edge' ? a * b2 : a * b2) };
  }
  function punchACI(p, c, m) {   // p: {pos,c1,c2,h,ph,d,Vcol,Uarea,Msc,Asbslab_m,Ab}
    const { pos, c1, c2, d } = p, cs = critSec(pos, c1, c2, d), ls = lamS(d), beta = Math.max(c1, c2) / Math.min(c1, c2), as = pos === 'Interior' ? 40 : (pos === 'Edge' ? 30 : 20);
    const Vu = Math.max(0, p.Vcol - p.Uarea * cs.area / 1e6), gf = 1 / (1 + 2 / 3 * Math.sqrt(cs.a / cs.b2)), gv = 1 - gf, Mc = p.Msc - Vu * cs.g / 1e3;
    const vuv = Vu * 1e3 / (cs.b0 * d), sIn = vuv + gv * Mc * 1e6 * cs.cIn / cs.J, sOut = vuv - gv * Mc * 1e6 * cs.cOut / cs.J, vu = Math.max(sIn, sOut);
    const k1 = 0.33, k2 = 0.17 + 0.33 / beta, k3 = 0.17 + 0.083 * as * d / cs.b0, kc = Math.min(k1, k2, k3), vc = kc * ls * m.sfc, phiVc = m.phiV * vc;
    const out = { ...p, cs, Vu, gf, gv, Mc, vuv, sIn, sOut, vu, beta, as, ls, kc, vc, phiVc, links: null, ratio: vu / phiVc };
    if (vu <= phiVc + 1e-9) out.st = 'OK';
    else {
      const lim = m.phiV * 0.5 * m.sfc;
      if (d < 150 || d < 16 * c.phiL) out.st = 'NOT OK (stirrups need d ≥ 150 mm and d ≥ 16db, ACI 22.6.7.1: increase h)';
      else if (vu > lim + 1e-9) out.st = 'NOT OK (vu = ' + f(vu, 2) + ' > φ·0.5√f′c = ' + f(lim, 2) + ' MPa: stirrups cannot be used — enlarge the column, h or add drop panel / shear cap)';
      else {
        const vs = Math.max(0, vu / m.phiV - 0.17 * m.sfc), s = Math.max(25, Math.floor(0.5 * d / 5) * 5), Avmin = 0.17 * m.sfc * cs.b0 * s / m.fyt, Avr = vs * cs.b0 * s / m.fyt, Av = Math.max(Avr, Avmin), Aleg = PI / 4 * c.phiL ** 2;
        const legs = Math.max(Math.ceil(Av / Aleg), Math.ceil(cs.b0 / (2 * d))), vuo = Vu * 1e3 / m.phiV, b0o = vuo / (0.17 * m.sfc * d), aOut = pos === 'Interior' ? (b0o - 2 * (c1 + c2)) / 8 : (pos === 'Edge' ? (b0o - 2 * c1 - c2) / 4 : (b0o - c1 - c2) / 2);
        const aLast = Math.max(aOut - d / 2, d / 2), lines = Math.max(2, Math.floor((aLast - d / 2) / (0.5 * d) + 1e-9) + 1);
        out.links = { vs, s, Avmin, Avr, Av, Aleg, legs, b0o, aOut, aLast, lines, vcs: 0.17 * m.sfc };
        out.st = 'OK (stirrups required)';
      }
    }
    // moment transfer by flexure within bslab = c2 + 3h (8.4.2.2.3)
    const bslab = c2 + 3 * p.h, Mf = gf * p.Msc, Ab = p.Ab, Asr = flexAs(Mf, d, bslab, m), AsminShear = out.vuv > 0.17 * ls * m.sfc ? 5 * out.vuv * bslab * cs.b0 / (m.phiV * as * m.fy) : 0, Aneed = Math.max(Asr, AsminShear), Aprov = p.AsM * bslab / 1000;
    out.mt = { bslab, Mf, Asr, AsminShear, Aneed, Aprov, add: Math.max(0, Math.ceil((Aneed - Aprov) / Ab - 1e-9)), Ab };
    return out;
  }
  function flexAs(Mu, d, b, m) { const arg = 1 - 2 * Mu * 1e6 / (0.9 * 0.85 * m.fc * b * d * d); return arg >= 0 ? 0.85 * m.fc * b * d / m.fy * (1 - Math.sqrt(arg)) : Infinity; }

  /* =================================================================== FLAT SLABS (EFM, ACI 8.11) */
  function flat(R, c, d) {
    const m = mat(c), S = R.S, n = R.n, gv = R.gov, mx = d.basis !== 'span', layer = d.layer, phi0 = d.phi, acimode = d.aciStrip !== 'user', o = R.o;
    const UL = { U: 0, comb: o.gG + 'D + ' + o.gQ + 'L' };
    const spans = R.rows.map((row, i) => {
      const L = S.L[i], b = S.b[i], h = S.h[i], bcs = 0.5 * Math.min(L, b), bms = Math.max(b - bcs, 1e-6);
      let ML = Math.max(0, -row.MLf), MR = Math.max(0, -row.MRf), Mp = Math.max(0, row.Mp), V = Math.max(Math.abs(row.VL), Math.abs(row.VR));
      if (mx) { ML = MR = gv.Mhf; Mp = gv.Mp; V = gv.V; }
      const pL = acimode ? (i === 0 ? 1.0 : 0.75) : d.sn / 100, pR = acimode ? (i === n - 1 ? 1.0 : 0.75) : d.sn / 100, pp = acimode ? 0.60 : d.sp / 100;
      const Z = (M, share, w) => flexZ(share * M / w, h, c, m, phi0, layer, 'two');
      const cs = { L: Z(ML, pL, bcs), S: Z(Mp, pp, bcs), R: Z(MR, pR, bcs) }, ms = { L: Z(ML, 1 - pL, bms), S: Z(Mp, 1 - pp, bms), R: Z(MR, 1 - pR, bms) };
      // one-way shear at d from the column face over the full strip width (ACI 22.5.5.1, 8.5.3.1.1)
      const dm = h - c.cover - cs.S.ph, zl = [cs.L, cs.R, ms.L, ms.R], Asp = Math.min(...zl.map(z => z.Asp)), vc = Vc1(Asp, 1000, dm, m), wu = row.wu / b;
      const VL = (mx ? V : Math.abs(row.VL)) - row.wu * (S.c1[i] / 2000 + dm / 1000), VRr = (mx ? V : Math.abs(row.VR)) - row.wu * (S.c1[i + 1] / 2000 + dm / 1000), Vred = Math.max(0, VL, VRr), phiVc = m.phiV * vc.Vc * b;
      const sh = { dm, ...vc, Asp, Vred, V, phiVc, wu, st: Vred <= phiVc + 1e-9 ? 'OK' : 'NOT OK (Vu = ' + f(Vred, 1) + ' kN > φVc = ' + f(phiVc, 1) + ' kN: increase h)' };
      // minimum thickness (Table 8.3.1.1, no drop panels)
      const ext = i === 0 || i === n - 1, ln = Math.max(L * 1000 - (S.c1[i] + S.c1[i + 1]) / 2, b * 1000 - Math.max(S.c2[i], S.c2[i + 1])), tb = { 280: ext ? 33 : 36, 420: ext ? 30 : 33, 550: ext ? 27 : 30 }, fy = Math.min(550, Math.max(280, m.fy));
      const den = fy <= 420 ? tb[280] + (tb[420] - tb[280]) * (fy - 280) / 140 : tb[420] + (tb[550] - tb[420]) * (fy - 420) / 130, hm = Math.max(ln / den, 125), rat = Math.max(L, b) / Math.min(L, b);
      const defl = { ln, den, hm, ext, st: rat > 2 ? 'NOT OK (long/short > 2: calculated deflections required, ACI 8.3.2.1(b))' : (h + 1e-9 >= hm ? 'OK (ACI Table 8.3.1.1: h = ' + h + ' ≥ ℓn/' + f(den, 1) + ' = ' + f(hm, 0) + ' mm)' : 'NOT OK (h = ' + h + ' < ' + f(hm, 0) + ' mm: increase h or verify calculated deflection, ACI 8.3.2)') };
      return { i, L, b, h, bcs, bms, ML, Mp, MR, V, pL, pR, pp, cs, ms, sh, defl, wu };
    });
    const punch = R.cols.map((cl, j) => {
      const pos = (S.pos && S.pos[j]) || (j === 0 || j === n ? 'Edge' : 'Interior'), adj = [j - 1, j].filter(i => i >= 0 && i < n);
      const tz = adj.map(i => j === i ? spans[i].cs.L : spans[i].cs.R), hc = Math.max(...adj.map(i => S.h[i])), ph = Math.max(...tz.map(z => z.ph)), dp = hc - c.cover - ph, Uarea = Math.max(...adj.map(i => spans[i].wu));
      const AsM = Math.max(...tz.map(z => z.Asp)), p = punchACI({ pos, c1: S.c1[j], c2: S.c2[j], h: hc, ph, d: dp, Vcol: Math.max(0, cl.N), Uarea, Msc: cl.M, AsM, Ab: PI / 4 * ph * ph }, c, m);
      return Object.assign(p, { j, dp, VEd: p.Vcol, MEd: cl.M });
    });
    // end-column bottom bar anchorage (ACI 8.7.4.2.2: 1.25 fy at exterior supports)
    const anchor = [0, n].map(j => { const i = j === 0 ? 0 : n - 1, z = spans[i].cs.S, k = 1.25, t = ldT(z.ph, z.s, c, m, spans[i].h, false), ldd = t.ld * k, hk = ldh(z.ph, m, k), lav = S.c1[j] - c.cover; return { j, ph: z.ph, ld: ldd, hk, lav, st: ldd <= lav + 1e-9 ? 'OK (straight ℓd(1.25fy) ≤ available)' : (hk <= lav + 1e-9 ? 'OK (standard hook: ℓdh(1.25fy) = ' + f(hk, 0) + ' ≤ ' + f(lav, 0) + ' mm)' : 'NOT OK (ℓd = ' + f(ldd, 0) + ' mm and ℓdh = ' + f(hk, 0) + ' mm > ' + f(lav, 0) + ' mm available in the column: larger column, smaller bars)') }; });
    // extensions (Fig. 8.7.4.1.3, no drop panels)
    const ext = spans.map(s => { const ln = s.defl.ln / 1000, d5 = 5 * (s.h - c.cover - s.cs.S.ph) / 1000; return { i: s.i, ln, topHalf: Math.max(0.30 * ln, d5), topRest: 0.20 * ln, botMid: 0.15 * ln }; });
    const agg = (arr, pick) => arr.map(pick).find(s => !okS(s)) || 'OK', zs = spans.flatMap(s => [s.cs.L, s.cs.S, s.cs.R, s.ms.L, s.ms.S, s.ms.R]);
    const st = { an: R.resOk ? 'OK' : 'NOT OK (global equilibrium residual ' + R.res.toExponential(1) + ' kNm)', flex: agg(zs, z => z.flex), spacing: agg(zs, z => z.spac), crack: agg(zs, z => z.crack), shear: agg(spans, s => s.sh.st), punch: agg(punch, p => p.st), defl: agg(spans, s => s.defl.st), anchorage: agg(anchor, a => a.st) };
    st.overall = Object.keys(st).every(k => okS(st[k])) ? 'OK' : 'NOT OK';
    const keys = [['an', 'Analysis'], ['flex', 'Flexure'], ['spacing', 'Spacing'], ['crack', 'Crack control'], ['shear', 'One-way shear'], ['punch', 'Punching'], ['defl', 'Deflection'], ['anchorage', 'Anchorage']];
    const bars = []; spans.forEach(s => { bars.push(['Span ' + (s.i + 1) + ' · column strip (' + f(s.bcs, 2) + ' m)', 'Bottom ' + s.cs.S.txt + ' · Top L ' + s.cs.L.txt + ' · Top R ' + s.cs.R.txt, GRN]); bars.push(['Span ' + (s.i + 1) + ' · middle strip (' + f(s.bms, 2) + ' m)', 'Bottom ' + s.ms.S.txt + ' · Top L ' + s.ms.L.txt + ' · Top R ' + s.ms.R.txt, CY]); });
    const extra = punch.filter(p => p.mt.add > 0).map(p => ['Extra top bars over column ' + nm(p.j) + ' (within c2 + 3h = ' + f(p.mt.bslab, 0) + ' mm)', '+ ' + p.mt.add + ' Ø' + p.ph, AMB]).concat(punch.filter(p => p.links).map(p => ['Punching stirrups · column ' + nm(p.j), 'Ø' + c.phiL + ' · ' + p.links.legs + ' legs/line · ' + p.links.lines + ' lines @ ' + p.links.s + ' mm (first at d/2)', AMB]));
    const res = { code: 'ACI', kind: 'flat', title: 'Flat slab · ACI 318-25', sub: R.n + ' spans · ' + (mx ? 'maximum values' : 'each span') + ' · ' + (acimode ? 'ACI 8.10.5 strip shares' : 'user strip shares'), R, c, m, d, spans, punch, anchor, ext, st, keys, bars: bars.concat(extra), UL,
      metrics: [['M⁺ max', f(gv.Mp, 1), 'kNm'], ['M⁻ face max', f(gv.Mhf, 1), 'kNm'], ['V max', f(gv.V, 1), 'kN']],
      notes: ['ACI load combination: ' + o.gG + 'D + ' + o.gQ + 'L; ' + (R.cases.length > 1 ? 'pattern loading with 75 % of the factored live load (ACI 6.4.3.3): ' + R.cases.length + ' cases.' : 'L ≤ 0.75D: factored L on all panels (ACI 6.4.3.2).'), 'Hogging moments are taken at the face of the support, not farther than 0.175ℓ from the column centre (ACI 8.4.2.1 / 8.11.6.1). The frame uses prismatic slab-beams between column centre-lines (approximation of ACI 8.11.3).', acimode ? 'Moment shares to the column strip: 75 % interior negative, 100 % exterior negative (no edge beam, βt = 0), 60 % positive (ACI 8.10.5, αf1 = 0).' : 'Moment shares to the column strip entered by the user.'] };
    res.steps = flatSteps(res); res.summary = bars.map(x => [x[0], x[1]]); return res;
  }
  function flatSteps(r) {
    const { c, m, R, spans, punch, anchor } = r, o = R.o, S = R.S, L = [], T = (t, rows) => L.push({ t, r: rows });
    T('1 · Materials & load combination (ACI 5.3.1)', [['f′c · fy · β1', '', c.fck + ' · ' + c.fyk + ' MPa · ' + f(m.b1, 3)], ['Factors', 'U = ' + o.gG + 'D + ' + o.gQ + 'L', 'loaded spans ' + S.L.map((_, i) => f(R.rows[i].wu, 1)).join(' · ') + ' kN/m'], ['Pattern loading', 'ACI 6.4.3', R.cases.length > 1 ? R.cases.length + ' cases (75 % L patterns)' : 'L on all panels']]);
    T('2 · Equivalent frame results (kNm, kN)', R.rows.map((rw, i) => ['Span ' + (i + 1), 'M⁻L(face) = ' + f(rw.MLf, 2) + ' · M⁺ = ' + f(rw.Mp, 2) + ' · M⁻R(face) = ' + f(rw.MRf, 2), 'V = ' + f(rw.VL, 1) + ' / ' + f(rw.VR, 1)]).concat([['Governing', 'M⁺ · M⁻(face) · V', f(R.gov.Mp, 2) + ' · ' + f(R.gov.Mhf, 2) + ' · ' + f(R.gov.V, 2), 1], ['Equilibrium residual', '', R.res.toExponential(1) + ' kNm']]));
    T('3 · Strip widths & shares (ACI 8.10.5 / 8.10.6)', [['Column strip', 'bcs = 2 × 0.25·min(ℓ1, ℓ2)', spans.map(s => f(s.bcs, 2)).join(' · ') + ' m'], ['Shares to column strip', 'interior neg · exterior neg · positive', f(spans[0].pL * 100, 0) + ' / ' + f(spans[0].pR * 100, 0) + ' · ' + f(spans[0].pp * 100, 0) + ' %', 1]]);
    const pick = fn => spans.flatMap(s => [['CS hogging L', s.cs.L, s.i], ['CS sagging', s.cs.S, s.i], ['CS hogging R', s.cs.R, s.i], ['MS hogging L', s.ms.L, s.i], ['MS sagging', s.ms.S, s.i], ['MS hogging R', s.ms.R, s.i]]).filter(a => fn(a[0])).reduce((a, b) => (!a || b[1].Mu > a[1].Mu) ? b : a, null);
    [['CS hogging', 'Column strip · hogging'], ['CS sagging', 'Column strip · sagging'], ['MS hogging', 'Middle strip · hogging'], ['MS sagging', 'Middle strip · sagging']].forEach(([k, t]) => { const a = pick(x => x.indexOf(k) === 0); if (!a) return; const z = a[1]; T('4 · Flexure · ' + t + ' (span ' + (a[2] + 1) + ')', [['Mu per metre', 'share·M/strip width', f(z.Mu, 2) + ' kNm/m · d = ' + f(z.d, 1) + ' mm'], ['As,req · As,min', '0.0018·b·h', f(z.Asr, 0) + ' · ' + f(z.Asmin, 0) + ' mm²/m'], ['Bars', 's ≤ min(2h ; 450) = ' + f(z.smax, 0), z.txt + ' → ' + f(z.Asp, 0) + ' mm²/m', 1], ['φMn', 'εt = ' + f(z.et, 4) + ' · φ = ' + f(z.phi, 2), f(z.phiMn, 2) + ' ' + (z.phiMn >= z.Mu ? '≥' : '<') + ' ' + f(z.Mu, 2) + ' kNm/m'], ['Status', '', z.flex === 'OK' && z.spac === 'OK' && okS(z.crack) ? 'OK' : 'NOT OK', 1]]); });
    const sp = spans.reduce((a, b) => (b.sh.Vred / b.sh.phiVc > a.sh.Vred / a.sh.phiVc) ? b : a);
    T('5 · One-way shear at d from the column face – span ' + (sp.i + 1), [['λs · ρw', '', f(sp.sh.ls, 3) + ' · ' + f(sp.sh.rho * 100, 3) + ' %'], ['Vc', '0.66λsρw^(1/3)√f′c·b·d', f(sp.sh.Vc * sp.b, 1) + ' kN (φVc = ' + f(sp.sh.phiVc, 1) + ')'], ['Vu', 'V − wu(c/2 + d)', f(sp.sh.Vred, 1) + ' kN'], ['Status', '', sp.sh.st, 1]]);
    T('6 · Punching shear – all columns (ACI 22.6, 8.4.4)', punch.map(p => ['Column ' + nm(p.j) + ' · ' + p.pos, 'Vu = ' + f(p.Vu, 1) + ' kN · Msc = ' + f(p.Msc, 1) + ' kNm', 'vu/φvc = ' + f(p.vu, 2) + '/' + f(p.phiVc, 2) + ' MPa · ' + (okS(p.st) ? (p.links ? 'stirrups' : 'OK') : 'NOT OK')]));
    const gp = punch.reduce((a, b) => b.ratio > a.ratio ? b : a), cs = gp.cs;
    T('7 · Punching – governing column ' + nm(gp.j) + ' (' + gp.pos + ')', [['d (mean of two layers)', 'h − cover − Ø', f(gp.d, 1) + ' mm'], ['Critical section (d/2 from the face)', 'b1 = ' + f(cs.a, 0) + ' · b2 = ' + f(cs.b2, 0), 'b0 = ' + f(cs.b0, 0) + ' mm'], ['Gravity shear', 'Vu = R − wu·(b1·b2)', f(gp.Vu, 1) + ' kN → vuv = ' + f(gp.vuv, 3) + ' MPa'], ['Fraction by flexure / shear', 'γf = 1/(1 + (2/3)√(b1/b2)) ; γv = 1 − γf', f(gp.gf, 3) + ' / ' + f(gp.gv, 3)], ['Section properties', 'Ac = b0·d ; centroid ; Jc (R8.4.4.2.3)', 'Jc = ' + f(cs.J, 0) + ' mm⁴ · c = ' + f(cs.cIn, 1) + ' / ' + f(cs.cOut, 1) + ' mm'], ['Moment at the centroid of the section', 'Msc − Vu·g (g = ' + f(cs.g, 1) + ' mm)', f(gp.Mc, 2) + ' kNm'], ['Maximum stress', 'vu = vuv ± γv·M·c/Jc', f(gp.vu, 3) + ' MPa', 1], ['Concrete strength', 'vc = min[0.33 ; 0.17 + 0.33/β ; 0.17 + 0.083αs·d/b0]·λs·√f′c (Table 22.6.5.2), β = ' + f(gp.beta, 2) + ' · αs = ' + gp.as + ' · λs = ' + f(gp.ls, 3), f(gp.vc, 3) + ' MPa → φvc = ' + f(gp.phiVc, 3), 1]]
      .concat(gp.links ? [['Stirrups required', 'vs = vu/φ − 0.17√f′c ; Av = vs·b0·s/fyt ≥ 0.17√f′c·b0·s/fyt', 'Av = ' + f(gp.links.Av, 0) + ' mm² / line · s = ' + gp.links.s + ' mm'], ['Layout', 'first line ≤ d/2 · s ≤ d/2 · leg spacing ≤ 2d (Table 8.7.6.3)', gp.links.legs + ' legs × ' + gp.links.lines + ' lines (to ' + f(gp.links.aLast, 0) + ' mm from the face)'], ['Outer critical section', 'vu ≤ φ·0.17√f′c at d/2 beyond the last line', 'outer perimeter ≥ ' + f(gp.links.b0o, 0) + ' mm']] : [])
      .concat([['Moment transfer by flexure', 'γf·Msc within bslab = c2 + 3h = ' + f(gp.mt.bslab, 0) + ' mm', f(gp.mt.Mf, 1) + ' kNm → As ≥ ' + f(gp.mt.Aneed, 0) + ' mm² (provided ' + f(gp.mt.Aprov, 0) + ') → ' + (gp.mt.add ? '+' + gp.mt.add + ' bars' : 'OK')], ['Status', '', gp.st, 1]]));
    T('8 · Detailing (ACI 8.7.4)', r.ext.map(e => ['Span ' + (e.i + 1) + ' extensions (ℓn = ' + f(e.ln, 2) + ' m)', 'column-strip top: 50 % ≥ max(0.30ℓn ; 5d), rest 0.20ℓn · bottom: 100 % CS continuous · MS bottom 50 % continuous, rest ≤ 0.15ℓn', 'top ≥ ' + f(e.topHalf, 2) + ' m (50 %) / ' + f(e.topRest, 2) + ' m from the support face']).concat(anchor.map(a => ['End column ' + nm(a.j) + ' – bottom bars', '≥ 2 CS bars through the column core, ℓd with 1.25fy (8.7.4.2.2)', a.st, okS(a.st) ? 0 : 1])));
    T('9 · Minimum thickness (ACI 8.3.1.1)', spans.map(s => ['Span ' + (s.i + 1), 'ℓn = ' + f(s.defl.ln, 0) + ' mm → h ≥ ℓn/' + f(s.defl.den, 1), f(s.defl.hm, 0) + ' mm (provided ' + s.h + ') → ' + (okS(s.defl.st) ? 'OK' : 'NOT OK')]));
    T('10 · Summary of checks', r.keys.map(k => [k[1], '', r.st[k[0]], okS(r.st[k[0]]) ? 0 : 1]).concat([['Overall', '', r.st.overall, 1]]));
    return L;
  }

  root.SL_ACID = { mat, factors, Uload, flexZ, Vc1, lamS, ldT, ldh, Ie, deflCalc, oneWay, twoWay, flat, punchACI, critSec, alphaF, minTh2 };
  if (typeof module !== 'undefined') module.exports = root.SL_ACID;
})(typeof window !== 'undefined' ? window : globalThis);
