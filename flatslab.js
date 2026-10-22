/* SlabLab – Flat slabs: Equivalent Frame Method (EFM) analysis + EC2 flat-slab design.
   Units: spans / widths / column heights in m, h / c1 / c2 in mm, loads kN/m², moments kNm, forces kN.
   Hogging negative, sagging positive in the analysis. Exposes SL_FLAT. */
(function (root) {
  'use strict';
  const N = 100, PI = Math.PI;
  const f = (x, n) => { if (!isFinite(x)) return '–'; const s = (+x).toFixed(n); return s.indexOf('.') >= 0 ? s.replace(/0+$/, '').replace(/\.$/, '') : s; };
  const nm = j => String.fromCharCode(65 + (j % 26));

  /* ============================ EFM analysis ============================ */
  function solve(A, B) {
    const n = B.length;
    for (let i = 0; i < n; i++) {
      let p = i; for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
      [A[i], A[p]] = [A[p], A[i]]; [B[i], B[p]] = [B[p], B[i]];
      for (let r = i + 1; r < n; r++) { const q = A[r][i] / A[i][i]; for (let c = i; c < n; c++) A[r][c] -= q * A[i][c]; B[r] -= q * B[i]; }
    }
    const x = Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) { let s = B[i]; for (let c = i + 1; c < n; c++) s -= A[i][c] * x[c]; x[i] = s / A[i][i]; }
    return x;
  }
  function colK(S, o) {
    const n = S.L.length;
    return S.c1.map((c1, j) => {
      c1 /= 1e3; const c2 = S.c2[j] / 1e3, I = c2 * c1 ** 3 / 12;
      const ka = S.Ha[j] > 0 ? o.fx * I / S.Ha[j] : 0, kb = S.Hb[j] > 0 ? o.fx * I / S.Hb[j] : 0, kc = ka + kb;
      const ad = [j - 1, j].filter(i => i >= 0 && i < n); let k = kc, Kt = Infinity;
      if (o.tor && kc > 0) {
        Kt = 0;
        ad.forEach(i => { const hh = S.h[i] / 1e3, x = Math.min(hh, c2), y = Math.max(hh, c2), C = (1 - .63 * x / y) * x ** 3 * y / 3, l2 = S.b[i]; Kt += 9 * C / (l2 * Math.pow(Math.max(.05, 1 - c2 / l2), 3)); });
        k = 1 / (1 / kc + 1 / Kt);
      }
      return { k, ka, kb, kc, Kt, kv: ((S.Ha[j] > 0 ? 1 / S.Ha[j] : 0) + (S.Hb[j] > 0 ? 1 / S.Hb[j] : 0)) * c1 * c2 };
    });
  }
  function analyse(S, o, w, K) {
    const n = w.length, m = n + 1, D = 2 * m, EI = S.L.map((L, i) => S.b[i] * (S.h[i] / 1e3) ** 3 / 12);
    const A = Array.from({ length: D }, () => Array(D).fill(0)), B = Array(D).fill(0);
    for (let i = 0; i < n; i++) {
      const L = S.L[i], e = EI[i] / L ** 3, F = w[i] * L * L / 12, ix = [2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 3];
      const ke = [[12, -6 * L, -12, -6 * L], [-6 * L, 4 * L * L, 6 * L, 2 * L * L], [-12, 6 * L, 12, 6 * L], [-6 * L, 2 * L * L, 6 * L, 4 * L * L]], fe = [-w[i] * L / 2, F, -w[i] * L / 2, -F];
      for (let r = 0; r < 4; r++) { B[ix[r]] += fe[r]; for (let c = 0; c < 4; c++) A[ix[r]][ix[c]] += e * ke[r][c]; }
    }
    for (let j = 0; j < m; j++) {
      A[2 * j + 1][2 * j + 1] += K[j].k;
      if (o.ax && K[j].kv > 0) A[2 * j][2 * j] += K[j].kv;
      else { for (let c = 0; c < D; c++) { A[2 * j][c] = 0; A[c][2 * j] = 0; } A[2 * j][2 * j] = 1; B[2 * j] = 0; }
    }
    const d = solve(A, B), th = Array.from({ length: m }, (_, j) => d[2 * j + 1]), vv = Array.from({ length: m }, (_, j) => d[2 * j]), M = [], V = [], R = Array(m).fill(0);
    for (let i = 0; i < n; i++) {
      const L = S.L[i], q = 2 * EI[i] / L, F = w[i] * L * L / 12, ps = (vv[i] - vv[i + 1]) / L;
      const M0 = -F + q * (2 * th[i] + th[i + 1] - 3 * ps), ML = -(F + q * (2 * th[i + 1] + th[i] - 3 * ps)), mm = [], v2 = [];
      for (let s = 0; s <= N; s++) { const x = L * s / N; mm.push(M0 + (ML - M0) * x / L + w[i] * x * (L - x) / 2); v2.push((ML - M0) / L + w[i] * (L - 2 * x) / 2); }
      M.push(mm); V.push(v2);
    }
    for (let j = 0; j < m; j++) R[j] = (j < n ? V[j][0] : 0) - (j > 0 ? V[j - 1][N] : 0);
    const Xs = [0]; let res = 0, sc = 0;
    for (let i = 0; i < n; i++) { Xs.push(Xs[i] + S.L[i]); res += w[i] * S.L[i] * (Xs[i] + S.L[i] / 2); sc += Math.abs(w[i]) * S.L[i] * S.L[i]; }
    for (let j = 0; j < m; j++) res -= R[j] * Xs[j] + K[j].k * th[j];
    return { M, V, R, th, res, sc, w };
  }
  function efm(S, o) {
    const n = S.L.length, m = n + 1, K = colK(S, o), X0 = [0]; S.L.forEach((L, i) => X0.push(X0[i] + L));
    const wu = i => (o.gG * S.g[i] + o.gQ * S.q[i]) * S.b[i], ws = i => (o.sG * S.g[i] + o.sQ * S.q[i]) * S.b[i], wd = i => o.gG * S.g[i] * S.b[i], end = i => i === 0 || i === n - 1;
    const CS = [
      { id: 'A', t: 'A · All spans ULS', f: i => 1 },
      { id: 'B', t: 'B · Interior ULS, end spans factored dead load only', f: i => !end(i) },
      { id: 'C', t: 'C · End ULS, interior factored dead load only', f: i => end(i) }];
    CS.forEach(c => { c.r = analyse(S, o, S.L.map((_, i) => c.f(i) ? wu(i) : wd(i)), K); });
    const mk = () => S.L.map(() => new Array(N + 1)), Mx = mk(), Mn = mk(), Vx = mk(), Vn = mk();
    for (let i = 0; i < n; i++) for (let s = 0; s <= N; s++) {
      const mm = CS.map(c => c.r.M[i][s]), vv = CS.map(c => c.r.V[i][s]);
      Mx[i][s] = Math.max(...mm); Mn[i][s] = Math.min(...mm); Vx[i][s] = Math.max(...vv); Vn[i][s] = Math.min(...vv);
    }
    const rows = [];
    for (let i = 0; i < n; i++) {
      let a = -1e99, xm = 0;
      CS.forEach(c => { const w = c.r.w[i], L = S.L[i], M0 = c.r.M[i][0], ML = c.r.M[i][N], xs = w > 0 ? Math.min(L, Math.max(0, c.r.V[i][0] / w)) : 0, v = M0 + (ML - M0) * xs / L + w * xs * (L - xs) / 2; if (v > a) { a = v; xm = xs; } });
      rows.push({ ML: Mn[i][0], Mp: a, xm, MR: Mn[i][N], VL: Vx[i][0], VR: Vn[i][N], wu: wu(i), ws: ws(i), wd: wd(i) });
    }
    const cols = K.map((k, j) => {
      const Rs = CS.map(x => x.r.R[j]), Ms = CS.map(x => k.k * x.r.th[j]), Mm = Math.max(...Ms.map(Math.abs)), sh = k.kc > 0 ? k.ka / k.kc : 0;
      return { N: Math.max(...Rs), Nmin: Math.min(...Rs), M: Mm, Ma: Mm * sh, Mb: Mm * (1 - sh), kec: k.kc > 0 ? k.k / k.kc : 0, k: k.k, kc: k.kc, Kt: k.Kt };
    });
    const res = Math.max(...CS.map(x => Math.abs(x.r.res))), scale = Math.max(1, ...CS.map(x => x.r.sc));
    let Mp = 0, Mh = 0, Vm = 0, iMp = 0, jMh = 0, iV = 0;
    rows.forEach((r, i) => {
      if (r.Mp > Mp) { Mp = r.Mp; iMp = i; }
      if (-r.ML > Mh) { Mh = -r.ML; jMh = i; } if (-r.MR > Mh) { Mh = -r.MR; jMh = i + 1; }
      const v = Math.max(Math.abs(r.VL), Math.abs(r.VR)); if (v > Vm) { Vm = v; iV = i; }
    });
    return { S, o, n, m, K, X0, cases: CS, env: { Mx, Mn, Vx, Vn }, rows, cols, res, resOk: res < 1e-6 * scale, gov: { Mp, Mh, V: Vm, iMp, jMh, iV } };
  }

  /* ============================ EC2 flat-slab design ============================ */
  const SIG = [160, 200, 240, 280, 320, 360], TAB = { 0.4: [300, 300, 250, 200, 150, 100], 0.3: [300, 250, 200, 150, 100, 50], 0.2: [200, 150, 100, 50, null, null] };
  function smaxT(s, wk) { // EC2 Table 7.3N (max bar spacing)
    const r = TAB[Number(wk)]; if (!r || !isFinite(s) || s < 0) return null; if (s <= 160) return r[0]; if (s > 360) return null;
    let k = 0; while (k < SIG.length - 2 && SIG[k + 1] < s) k++; if (s === SIG[k]) return r[k]; if (s === SIG[k + 1]) return r[k + 1];
    const a = r[k], b = r[k + 1]; if (a == null || b == null) return null; return a + (b - a) * (s - SIG[k]) / (SIG[k + 1] - SIG[k]);
  }
  const mat = c => ({ fcd: c.acc * c.fck / c.gc, fyd: c.fyk / c.gs, fctd: 0.7 * c.fctm / c.gc, nu: 0.6 * (1 - c.fck / 250) });
  const okS = s => /^OK/.test(s);
  function anch(ph, c, m, h, top) { // EC2 8.4.2 / 8.4.4 with α1..α5 = 1
    const eta1 = (top && h > 250) ? 0.7 : 1, eta2 = ph <= 32 ? 1 : (132 - ph) / 100, fbd = 2.25 * eta1 * eta2 * m.fctd, lb = ph / 4 * m.fyd / fbd;
    return { fbd, lb, lmin: Math.max(0.3 * lb, 10 * ph, 100) };
  }

  /* one flexural zone, per metre width. Mm kNm/m (>=0) */
  function zone(Mm, h, c, m, phi0, layer, sr) {
    const list = [phi0, 12, 14, 16, 20, 25].filter((v, i, a) => v >= phi0 && a.indexOf(v) === i).sort((a, b) => a - b);
    let z; for (const ph of list) { z = trial(ph); if (z.s >= 100) break; } return z;
    function trial(ph) {
      const d = h - c.cover - (layer === 'inner' ? 1.5 : 0.5) * ph, K = Mm * 1e6 / (1000 * d * d * m.fcd), Ku = Math.min(K, c.Kl), kOk = K <= c.Kl;
      const zz = Math.min(0.95 * d, d * (0.5 + Math.sqrt(0.25 - Ku / 2))), Asr = Mm * 1e6 / (m.fyd * zz);
      const Asmin = Math.max(0.26 * c.fctm / c.fyk * 1000 * d, 0.0013 * 1000 * d), Asmax = 0.04 * 1000 * h, Asu = Math.max(Asr, Asmin);
      const Ab = PI / 4 * ph * ph, smx = Math.min(2 * h, 250), s0 = Math.max(0, Math.min(smx, Math.floor(1000 * Ab / Asu / 25) * 25));
      let s2 = s0, Asp = 0, sig = 0, lim = null;
      for (let it = 0; it < 40; it++) { Asp = s2 > 0 ? 1000 * Ab / s2 : 0; sig = Asp > 0 ? m.fyd * (Asr / Asp) * sr : 0; lim = smaxT(sig, c.wk); if (lim != null && s2 > lim && s2 > 25) s2 -= 25; else break; }
      const s = s2, x = Asp * m.fyd / (0.8 * 1000 * m.fcd), zp = d - 0.4 * x, MRd = Asp * m.fyd * zp / 1e6;
      const flex = !kOk ? 'NOT OK (K = ' + f(K, 3) + ' > K′ = ' + f(c.Kl, 3) + ': increase h or add compression steel)' : (Asu > Asmax ? 'NOT OK (As > As,max)' : (MRd >= Mm - 1e-9 ? 'OK' : 'NOT OK (MRd < MEd)'));
      const spac = s >= 75 && s <= smx ? 'OK' : 'NOT OK (spacing ' + s + ' mm outside 75…' + smx + ')';
      const crack = lim == null ? 'NOT OK (Table 7.3N not applicable at σs = ' + f(sig, 0) + ' MPa)' : (s <= lim ? 'OK' : 'NOT OK (spacing > ' + f(lim, 0) + ' mm, Table 7.3N)');
      return { Mm, h, d, K, kOk, z: zz, Asr, Asmin, Asmax, Asu, ph, s, Asp, x, zp, MRd, sig, lim, txt: 'Ø' + ph + '@' + s, flex, spac, crack };
    }
  }

  function design(R, c, d) {
    const S = R.S, n = R.n, m = mat(c), pn = d.sn / 100, pp = d.sp / 100, mx = d.basis !== 'span', gv = R.gov, layer = d.layer, phi0 = d.phi;
    const spans = R.rows.map((row, i) => {
      const L = S.L[i], b = S.b[i], h = S.h[i], bcs = 0.5 * Math.min(L, b), bms = Math.max(b - bcs, 1e-6), sr = row.wu > 0 ? Math.min(1, row.ws / row.wu) : 1;
      let ML = Math.max(0, -row.ML), MR = Math.max(0, -row.MR), Mp = Math.max(0, row.Mp), V = Math.max(Math.abs(row.VL), Math.abs(row.VR));
      if (mx) { ML = MR = gv.Mh; Mp = gv.Mp; V = gv.V; }
      const Z = (M, share, w) => zone(share * M / w, h, c, m, phi0, layer, sr);
      const cs = { L: Z(ML, pn, bcs), S: Z(Mp, pp, bcs), R: Z(MR, pn, bcs) }, ms = { L: Z(ML, 1 - pn, bms), S: Z(Mp, 1 - pp, bms), R: Z(MR, 1 - pn, bms) };
      // one-way shear (EC2 6.2.2) at d from the column face, across the full strip width
      const ph = cs.S.ph, dm = h - c.cover - ph, k = Math.min(2, 1 + Math.sqrt(200 / dm)), vmin = 0.035 * Math.pow(k, 1.5) * Math.sqrt(c.fck);
      const Asp = Math.min(cs.L.Asp, cs.R.Asp, ms.L.Asp, ms.R.Asp), rho = Math.min(0.02, Asp / (1000 * dm)), vrdc = Math.max(0.18 / c.gc * k * Math.pow(100 * rho * c.fck, 1 / 3), vmin);
      const VRdc = vrdc * b * 1000 * dm / 1000, wL = row.wu, VL = (mx ? V : Math.abs(row.VL)) - wL * (S.c1[i] / 2000 + dm / 1000), VRr = (mx ? V : Math.abs(row.VR)) - wL * (S.c1[i + 1] / 2000 + dm / 1000), Vred = Math.max(0, VL, VRr);
      const sh = { dm, k, rho, vrdc, VRdc, V, Vred, st: Vred <= VRdc ? 'OK' : 'NOT OK (VEd = ' + f(Vred, 1) + ' kN > VRd,c = ' + f(VRdc, 1) + ' kN: increase h or add shear reinforcement)' };
      // deflection – span/depth (EC2 7.4.2, K = 1.2 flat slab) on the column-strip sagging zone
      const z = cs.S, rho0 = Math.sqrt(c.fck) / 1000, rr = Math.max(z.Asr, z.Asmin) / (1000 * z.d), q = rho0 / rr;
      const basic = 1.2 * (rr <= rho0 ? 11 + 1.5 * Math.sqrt(c.fck) * q + 3.2 * Math.sqrt(c.fck) * Math.pow(Math.max(0, q - 1), 1.5) : 11 + 1.5 * Math.sqrt(c.fck) * q);
      const f1 = Math.min((z.Asp / Math.max(z.Asr, 1e-9)) * (500 / c.fyk), 1.5), f2 = L > 8.5 ? 8.5 / L : 1, lim = basic * f1 * f2, act = L * 1000 / z.d;
      const defl = { rho: rr, rho0, basic, f1, f2, lim, act, st: lim >= act ? 'OK' : 'NOT OK (L/d = ' + f(act, 1) + ' > ' + f(lim, 1) + ')' };
      return { i, L, b, h, bcs, bms, sr, ML, Mp, MR, V, cs, ms, sh, defl };
    });

    /* punching shear (EC2 6.4) */
    const punch = R.cols.map((cl, j) => {
      const c1 = S.c1[j], c2 = S.c2[j], pos = (S.pos && S.pos[j]) || (j === 0 || j === n ? 'Edge' : 'Interior'), adj = [j - 1, j].filter(i => i >= 0 && i < n);
      const tz = adj.map(i => j === i ? spans[i].cs.L : spans[i].cs.R), hc = Math.max(...adj.map(i => S.h[i])), ph = Math.max(...tz.map(z => z.ph)), Ast = Math.max(...tz.map(z => z.Asp));
      const dp = hc - c.cover - ph, VEd = Math.max(0, cl.N), MEd = cl.M;
      let u0, u1, beta, W1 = null, kk = null, ecc = null;
      if (pos === 'Interior') {
        u0 = 2 * (c1 + c2); u1 = u0 + 4 * PI * dp; const r = c1 / c2; kk = r <= 0.5 ? 0.45 : r <= 1 ? 0.45 + 0.15 * (r - 0.5) / 0.5 : r <= 2 ? 0.6 + 0.1 * (r - 1) : r <= 3 ? 0.7 + 0.1 * (r - 2) : 0.8;
        W1 = c1 * c1 / 2 + c1 * c2 + 4 * c2 * dp + 16 * dp * dp + 2 * PI * dp * c1; beta = 1 + (VEd > 0 ? kk * MEd * 1e6 / (VEd * 1e3) * u1 / W1 : 0);
      } else if (pos === 'Edge') { u0 = Math.min(c2 + 3 * dp, c2 + 2 * c1); u1 = c2 + 2 * c1 + 2 * PI * dp; beta = 1.4; }
      else { u0 = Math.min(3 * dp, c1 + c2); u1 = c1 + c2 + PI * dp; beta = 1.5; }
      const nu = m.nu, vmax = 0.4 * nu * m.fcd, k = Math.min(2, 1 + Math.sqrt(200 / dp)), rho = Math.min(0.02, Ast / (1000 * dp)), vmin = 0.035 * Math.pow(k, 1.5) * Math.sqrt(c.fck);
      const vrdc = Math.max(0.18 / c.gc * k * Math.pow(100 * rho * c.fck, 1 / 3), vmin), v1 = beta * VEd * 1e3 / (u1 * dp), v0 = beta * VEd * 1e3 / (u0 * dp);
      let st, links = null;
      if (v0 > vmax) st = 'NOT OK (vEd,u0 = ' + f(v0, 2) + ' > vRd,max = ' + f(vmax, 2) + ' MPa: enlarge column or slab)';
      else if (v1 <= vrdc) st = 'OK';
      else if (v1 > 1.5 * vrdc) st = 'NOT OK (vEd = ' + f(v1, 2) + ' > 1.5·vRd,c: increase h or column size)';
      else {
        const sr = 0.75 * dp, fy = Math.min(m.fyd, 250 + 0.25 * dp), Aleg = PI / 4 * c.phiL * c.phiL, st1 = 1.5 * dp;
        const Areq = (v1 - 0.75 * vrdc) * u1 * sr / (1.5 * fy), Amin = 0.08 * Math.sqrt(c.fck) / c.fyk * sr * st1 / 1.5, Asw = Math.max(Areq, Amin), legs = Math.max(4, Math.ceil(Asw / Aleg));
        const uout = beta * VEd * 1e3 / (vrdc * dp), aout = pos === 'Interior' ? (uout - 2 * (c1 + c2)) / (2 * PI) : pos === 'Edge' ? (uout - c2 - 2 * c1) / PI : (uout - c1 - c2) * 2 / PI;
        const alast = Math.max(aout - 1.5 * dp, 0.5 * dp), nP = Math.max(2, Math.ceil((alast - 0.5 * dp) / sr) + 1);
        links = { sr, fy, Aleg, Areq, Amin, Asw, legs, uout, aout, alast, nP, st1, vrd: 0.75 * vrdc + 1.5 * (dp / sr) * Asw * fy / (u1 * dp) };
        st = 'OK (shear links required)';
      }
      let mt = null;
      if (pos !== 'Interior') { const be = c2 + c1, Mt = 0.17 * be * dp * dp * c.fck / 1e6; mt = { be, Mt, st: MEd <= Mt ? 'OK' : 'NOT OK (MEd = ' + f(MEd, 1) + ' > Mt,max = ' + f(Mt, 1) + ' kNm)' }; if (!okS(mt.st) && okS(st)) st = mt.st; }
      return { j, pos, c1, c2, hc, ph, Ast, dp, VEd, MEd, u0, u1, beta, W1, kk, nu, vmax, k, rho, vmin, vrdc, v1, v0, ratio: v1 / vrdc, links, mt, st };
    });

    /* detailing: top-bar extents (contraflexure of the hogging envelope + al + lbd), end-support anchorage */
    const det = punch.map((p, j) => {
      const Mn = R.env.Mn, ext = side => {
        const i = side < 0 ? j - 1 : j; if (i < 0 || i >= n) return null; const L = S.L[i]; let xcf = L;
        for (let s = 0; s <= N; s++) { const idx = side < 0 ? N - s : s; if (Mn[i][idx] >= -1e-6) { xcf = L * s / N; break; } }
        const z = side < 0 ? spans[i].cs.R : spans[i].cs.L, a = anch(z.ph, c, m, S.h[i], true), lbd = Math.max(a.lb, a.lmin), dd = z.d;
        return { x: Math.min(L, xcf + dd / 1000 + lbd / 1000), xcf, lbd, ph: z.ph };
      };
      return { j, left: ext(-1), right: ext(1) };
    });
    const anchor = [0, n].map(j => {
      const i = j === 0 ? 0 : n - 1, sp = spans[i], z = sp.cs.S, zm = sp.ms.S, Vd = j === 0 ? Math.abs(R.rows[0].VL) : Math.abs(R.rows[n - 1].VR), dd = z.d;
      const FE = Vd * 1e3 * dd / (0.9 * dd), Asr = FE / m.fyd, Atot = (z.Asp * sp.bcs + zm.Asp * sp.bms), Asp = Atot * (c.frac || 0.5);
      const a = anch(z.ph, c, m, S.h[i], false), lreq = Math.max(a.lb * Math.min(1, Asr / Math.max(Asp, 1e-9)), a.lmin), cd = Math.min(z.s / 2, c.cover), a2 = Math.min(1, Math.max(0.7, 1 - 0.15 * (cd - z.ph) / z.ph));
      const lbd = Math.max(a.lb * a2 * Math.min(1, Asr / Math.max(Asp, 1e-9)), a.lmin), lav = S.c1[j] - c.cover;
      return { j, FE, Asr, Asp, lb: a.lb, a2, lbd, lav, ph: z.ph, st: lbd <= lav ? 'OK' : 'NOT OK (lbd = ' + f(lbd, 0) + ' mm > ' + f(lav, 0) + ' mm available in the column: use a bend/hook or a larger column)' };
    });

    const agg = (arr, pick) => { const bad = arr.map(pick).find(s => !okS(s)); return bad || 'OK'; };
    const zs = spans.flatMap(s => [s.cs.L, s.cs.S, s.cs.R, s.ms.L, s.ms.S, s.ms.R]);
    const st = {
      an: R.resOk ? 'OK' : 'NOT OK (global equilibrium residual ' + R.res.toExponential(1) + ' kNm)',
      flex: agg(zs, z => z.flex), spacing: agg(zs, z => z.spac), crack: agg(zs, z => z.crack), shear: agg(spans, s => s.sh.st), punch: agg(punch, p => p.st),
      defl: agg(spans, s => s.defl.st), anchorage: agg(anchor, a => a.st)
    };
    st.overall = Object.keys(st).every(k => okS(st[k])) ? 'OK' : 'NOT OK';
    const link = punch.filter(p => p.links).length;
    return { R, c, m, d, spans, punch, det, anchor, st, link, S, n, gov: gv };
  }

  /* ============================ step-by-step solution ============================ */
  function steps(D) {
    const { R, c, m, d, spans, punch, anchor, S, n } = D, o = R.o, L = [], T = (t, r) => L.push({ t, r }), nmj = nm;
    T('1 · Materials & parameters', [
      ['Concrete design strength', 'fcd = αcc·fck/γc = ' + f(c.acc, 2) + '×' + c.fck + '/' + c.gc, f(m.fcd, 2) + ' MPa'],
      ['Steel design strength', 'fyd = fyk/γs = ' + c.fyk + '/' + c.gs, f(m.fyd, 1) + ' MPa'],
      ['Cover · main bar · link bar', '', c.cover + ' mm · Ø' + d.phi + ' · Ø' + c.phiL],
      ['Effective depth', d.layer === 'inner' ? 'd = h − c − 1.5Ø (inner layer)' : 'd = h − c − Ø/2 (outer layer)', 'per span'],
      ['Partial factors (ULS)', 'γG · γQ', f(o.gG, 2) + ' · ' + f(o.gQ, 2)]]);
    T('2 · Loads on each frame strip', S.L.map((_, i) => ['Span ' + (i + 1) + ' (l2 = ' + f(S.b[i], 2) + ' m)', 'wu = (' + f(o.gG, 2) + '×' + f(S.g[i], 2) + ' + ' + f(o.gQ, 2) + '×' + f(S.q[i], 2) + ')×' + f(S.b[i], 2) + ' · wsls = (' + f(o.sG, 2) + 'g + ' + f(o.sQ, 2) + 'q)·l2', f(R.rows[i].wu, 2) + ' · ' + f(R.rows[i].ws, 2) + ' kN/m']));
    T('3 · Column stiffness (equivalent column)', R.K.map((k, j) => ['Column ' + nmj(j) + ' (' + S.c1[j] + '×' + S.c2[j] + ')', 'Kc = ' + (o.fx === 4 ? '4' : '3') + 'EI/H above + below = ' + f(k.kc, 3) + (o.tor && isFinite(k.Kt) ? ' · Kt = ' + f(k.Kt, 3) + ' → 1/Kec = 1/Kc + 1/Kt' : ''), 'Kec/Kc = ' + f(k.kc > 0 ? k.k / k.kc : 0, 3)]));
    T('4 · EFM results – envelope of load cases A, B, C (kNm, kN)', R.rows.map((r, i) => ['Span ' + (i + 1), 'M⁻L = ' + f(r.ML, 2) + ' · M⁺ = ' + f(r.Mp, 2) + ' (x = ' + f(r.xm, 2) + ' m) · M⁻R = ' + f(r.MR, 2), 'V = ' + f(r.VL, 1) + ' / ' + f(r.VR, 1)]).concat([['Global equilibrium residual', 'Σ(load moments − reactions − column moments)', R.res.toExponential(1) + ' kNm', 1]]));
    const g = R.gov;
    T('5 · Governing design values', [
      ['Maximum sagging moment', 'span ' + (g.iMp + 1), f(g.Mp, 2) + ' kNm', 1], ['Maximum hogging moment', 'support ' + nmj(g.jMh), f(g.Mh, 2) + ' kNm', 1], ['Maximum shear force', 'span ' + (g.iV + 1), f(g.V, 2) + ' kN', 1],
      ['Design basis', '', d.basis === 'span' ? 'Each span uses its own envelope values' : 'All spans designed for the maximum values above']]);
    T('6 · Strip widths & moment distribution (EC2 Annex I)', [
      ['Column strip width', 'bcs = 2 × 0.25·min(L, l2)', S.L.map((l, i) => f(spans[i].bcs, 2)).join(' · ') + ' m'], ['Middle strip width', 'bms = l2 − bcs', S.L.map((l, i) => f(spans[i].bms, 2)).join(' · ') + ' m'],
      ['Hogging moment to column strip', 'chosen by user (EC2: 60–80 %)', d.sn + ' % → middle strip ' + (100 - d.sn) + ' %', 1], ['Sagging moment to column strip', 'chosen by user (EC2: 50–70 %)', d.sp + ' % → middle strip ' + (100 - d.sp) + ' %', 1],
      ['Moment per metre width', 'm = share × M / strip width', 'used in every zone']]);
    const all = []; spans.forEach(s => [['Column strip · hogging left', s.cs.L, s.i], ['Column strip · sagging', s.cs.S, s.i], ['Column strip · hogging right', s.cs.R, s.i], ['Middle strip · hogging left', s.ms.L, s.i], ['Middle strip · sagging', s.ms.S, s.i], ['Middle strip · hogging right', s.ms.R, s.i]].forEach(a => all.push(a)));
    const flexStep = (title, z, span) => T(title, [
      ['Moment per metre · effective depth', 'm = ' + f(z.Mm, 2) + ' kNm/m · d = ' + f(z.h, 0) + ' − ' + c.cover + ' − ' + (d.layer === 'inner' ? '1.5' : '0.5') + '×' + z.ph, f(z.d, 1) + ' mm'],
      ['K = m/(b·d²·fcd)', f(z.Mm, 2) + '×10⁶/(1000×' + f(z.d, 1) + '²×' + f(m.fcd, 2) + ')', f(z.K, 4) + (z.kOk ? ' ≤ K′ ' + f(c.Kl, 3) : ' > K′'), 1],
      ['Lever arm', 'z = d[0.5 + √(0.25 − K/2)] ≤ 0.95d', f(z.z, 1) + ' mm'],
      ['As,req', 'm/(fyd·z)', f(z.Asr, 0) + ' mm²/m'], ['As,min', 'max(0.26·fctm/fyk·b·d ; 0.0013·b·d)', f(z.Asmin, 0) + ' mm²/m'],
      ['Bars', 'Ø' + z.ph + ' at s ≤ min(2h, 250), multiple of 25', z.txt + ' → As,prov = ' + f(z.Asp, 0) + ' mm²/m', 1],
      ['Resistance', 'MRd = As,prov·fyd·(d − 0.4x)', f(z.MRd, 2) + ' kNm/m ' + (z.MRd >= z.Mm ? '≥' : '<') + ' ' + f(z.Mm, 2)],
      ['Crack control (Table 7.3N)', 'σs = fyd·(As,req/As,prov)·(wsls/wu) = ' + f(z.sig, 0) + ' MPa → smax', z.lim == null ? 'n/a' : f(z.lim, 0) + ' mm (s = ' + z.s + ')'],
      ['Status', '', z.flex === 'OK' && z.spac === 'OK' && z.crack === 'OK' ? 'OK' : 'NOT OK', 1]]);
    const pick = (cond) => all.filter(cond).reduce((a, b) => (!a || b[1].Mm > a[1].Mm) ? b : a, null);
    [['Flexure · column strip · governing hogging', a => /Column.*hogging/.test(a[0])], ['Flexure · middle strip · governing hogging', a => /Middle.*hogging/.test(a[0])], ['Flexure · column strip · governing sagging', a => /Column.*sagging/.test(a[0])], ['Flexure · middle strip · governing sagging', a => /Middle.*sagging/.test(a[0])]].forEach((q, k) => { const a = pick(q[1]); if (a) flexStep('7' + 'abcd'[k] + ' · ' + q[0] + ' (span ' + (a[2] + 1) + ')', a[1]); });
    T('8 · Reinforcement summary (per span)', spans.map(s => ['Span ' + (s.i + 1), 'CS: top ' + s.cs.L.txt + ' | bottom ' + s.cs.S.txt + ' | top ' + s.cs.R.txt, 'MS: top ' + s.ms.L.txt + ' | bottom ' + s.ms.S.txt + ' | top ' + s.ms.R.txt]));
    const sp = spans.reduce((a, b) => (b.sh.Vred / b.sh.VRdc > a.sh.Vred / a.sh.VRdc) ? b : a);
    T('9 · One-way shear at d from the column face (EC2 6.2.2) – span ' + (sp.i + 1), [
      ['Design shear', 'V = ' + f(sp.sh.V, 1) + ' kN − wu·(c/2 + d) ', f(sp.sh.Vred, 1) + ' kN', 1], ['Factors', 'k = 1 + √(200/d) ≤ 2 · ρl = As/(b·d) ≤ 0.02', f(sp.sh.k, 2) + ' · ' + f(sp.sh.rho * 100, 3) + ' %'],
      ['VRd,c', 'max[0.18/γc·k·(100ρl·fck)^(1/3) ; 0.035k^1.5·√fck]·b·d', f(sp.sh.vrdc, 3) + ' MPa → ' + f(sp.sh.VRdc, 1) + ' kN'], ['Status', 'VEd ≤ VRd,c', sp.sh.st, 1]]);
    T('10 · Punching shear – all columns (EC2 6.4)', punch.map(p => ['Column ' + nmj(p.j) + ' · ' + p.pos, 'VEd = ' + f(p.VEd, 1) + ' kN · MEd = ' + f(p.MEd, 1) + ' kNm · β = ' + f(p.beta, 2), 'vEd/vRd,c = ' + f(p.v1, 2) + '/' + f(p.vrdc, 2) + ' · ' + (okS(p.st) ? (p.links ? 'links' : 'OK') : 'NOT OK')]));
    const gp = punch.reduce((a, b) => b.ratio > a.ratio ? b : a);
    T('11 · Punching shear – governing column ' + nmj(gp.j) + ' (' + gp.pos + ')', [
      ['Effective depth', 'd = h − c − Ø (mean of two layers)', f(gp.dp, 1) + ' mm'],
      ['Control perimeters', gp.pos === 'Interior' ? 'u0 = 2(c1+c2) · u1 = u0 + 4π·d' : gp.pos === 'Edge' ? 'u0 = min(c2+3d, c2+2c1) · u1 = c2 + 2c1 + 2π·d' : 'u0 = min(3d, c1+c2) · u1 = c1 + c2 + π·d', 'u0 = ' + f(gp.u0, 0) + ' · u1 = ' + f(gp.u1, 0) + ' mm'],
      ['Eccentricity factor β', gp.pos === 'Interior' ? 'β = 1 + k·MEd·u1/(VEd·W1) · k = ' + f(gp.kk, 2) + ' · W1 = ' + f(gp.W1, 0) : 'EC2 Fig. 6.21N simplified value', f(gp.beta, 3)],
      ['Applied stress', 'vEd = β·VEd/(u1·d)', f(gp.v1, 3) + ' MPa', 1],
      ['Check at column face', 'vEd,u0 = β·VEd/(u0·d) ≤ vRd,max = 0.4·ν·fcd', f(gp.v0, 2) + ' ≤ ' + f(gp.vmax, 2) + ' MPa'],
      ['Resistance without links', 'vRd,c = max[0.18/γc·k·(100ρl·fck)^(1/3) ; vmin] · ρl = ' + f(gp.rho * 100, 3) + ' % · k = ' + f(gp.k, 2), f(gp.vrdc, 3) + ' MPa', 1]]
      .concat(gp.links ? [
        ['Links: required Asw per perimeter', 'Asw = (vEd − 0.75vRd,c)·u1·sr/(1.5·fywd,ef) · sr = 0.75d = ' + f(gp.links.sr, 0) + ' mm · fywd,ef = ' + f(gp.links.fy, 0), f(gp.links.Areq, 0) + ' mm²'],
        ['Minimum link area', 'Asw,min = 0.08√fck/fyk · sr·st/1.5', f(gp.links.Amin, 0) + ' mm²'],
        ['Links provided', 'Ø' + c.phiL + ' legs ≥ Asw/Aleg', gp.links.legs + ' legs / perimeter × ' + gp.links.nP + ' perimeters', 1],
        ['Outer perimeter without links', 'uout = β·VEd/(vRd,c·d)', f(gp.links.uout, 0) + ' mm → last perimeter ≤ ' + f(gp.links.alast, 0) + ' mm from face']] : [])
      .concat(gp.mt ? [['Moment transfer (edge/corner)', 'Mt,max = 0.17·be·d²·fck · be = c2 + c1 = ' + f(gp.mt.be, 0), f(gp.mt.Mt, 1) + ' kNm ' + (gp.MEd <= gp.mt.Mt ? '≥' : '<') + ' MEd = ' + f(gp.MEd, 1)]] : [])
      .concat([['Status', '', gp.st, 1]]));
    const dl = spans.reduce((a, b) => (b.defl.act / b.defl.lim > a.defl.act / a.defl.lim) ? b : a);
    T('12 · Deflection – span/depth (EC2 7.4.2) – span ' + (dl.i + 1), [
      ['Reinforcement ratio', 'ρ = max(As,req ; As,min)/(b·d) · ρ0 = √fck/1000', f(dl.defl.rho * 100, 3) + ' % · ' + f(dl.defl.rho0 * 100, 3) + ' %'],
      ['Basic span/depth', 'K·[11 + 1.5√fck·ρ0/ρ + …] · K = 1.2 (flat slab)', f(dl.defl.basic, 1)], ['Modification', 'F1 = min(As,prov/As,req·500/fyk ; 1.5) · F2 = 8.5/L if L > 8.5 m', f(dl.defl.f1, 2) + ' · ' + f(dl.defl.f2, 2)],
      ['Limit vs actual', 'L/d ≤ basic·F1·F2', f(dl.defl.act, 1) + ' ' + (dl.defl.act <= dl.defl.lim ? '≤' : '>') + ' ' + f(dl.defl.lim, 1), 1]]);
    T('13 · Detailing & anchorage (EC2 8.4, 9.2.1.3, 9.4)',
      D.det.map(x => { const a = x.left, b = x.right; return ['Top bars at column ' + nmj(x.j), 'x = contraflexure + d + lbd', (a ? 'left ' + f(a.x, 2) + ' m' : '') + (a && b ? ' · ' : '') + (b ? 'right ' + f(b.x, 2) + ' m' : '')]; })
        .concat(anchor.map(a => ['End column ' + nmj(a.j) + ' bottom bars', 'FE = V·al/z = ' + f(a.FE, 1) + ' kN · lbd = α·lb,rqd·As,req/As,prov ≥ lb,min = ' + f(a.lbd, 0) + ' mm', f(a.lbd, 0) + ' mm ≤ ' + f(a.lav, 0) + ' mm → ' + (okS(a.st) ? 'OK' : 'NOT OK'), 1]))
        .concat([['Bottom bars at internal columns', 'EC2 9.4.1(3): at least 2 bars each way through the column', 'provide'], ['Top bars over columns', 'EC2 9.4.1(2): ≥ 50 % of column-strip top steel within 0.125·l2 each side', 'provide']]));
    const st = D.st, lab = { an: 'Analysis', flex: 'Flexure', spacing: 'Spacing', crack: 'Crack control', shear: 'One-way shear', punch: 'Punching', defl: 'Deflection', anchorage: 'Anchorage' };
    T('14 · Summary of checks', Object.keys(lab).map(k => [lab[k], '', st[k], okS(st[k]) ? 0 : 1]).concat([['Overall', '', st.overall, 1]]));
    return L;
  }

  /* ============================ drawings (SVG, theme variables) ============================ */
  const RED = '#EF4444', YEL = '#F5C518', GRN = '#12C26B', CY = '#1DD3F0', CY2 = '#0DAFCB', AMB = '#F5A524';
  const Tx = (x, y, t, o) => { o = o || {}; return '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" font-size="' + (o.s || 8.5) + '" font-weight="' + (o.w || 600) + '" text-anchor="' + (o.a || 'middle') + '" style="fill:' + (o.c || 'var(--mu)') + '">' + t + '</text>'; };
  function arrow(x, y1, y2) { return '<path d="M' + x.toFixed(1) + ' ' + y1 + 'V' + (y2 - 3) + '" stroke="' + GRN + '" stroke-width="1.1" fill="none"/><path d="M' + (x - 2.4).toFixed(1) + ' ' + (y2 - 4.2) + 'L' + x.toFixed(1) + ' ' + y2 + 'L' + (x + 2.4).toFixed(1) + ' ' + (y2 - 4.2) + 'z" fill="' + GRN + '"/>'; }
  function frameBase(S, X0, xs, sc, yS) {
    let b = ''; const n = S.L.length;
    S.L.forEach((l, i) => { const a = xs[i], z = xs[i + 1]; b += '<path d="M' + a.toFixed(1) + ' ' + (yS - 14) + 'H' + z.toFixed(1) + '" stroke="' + GRN + '" stroke-width="1.2"/>'; const cnt = Math.max(3, Math.min(14, Math.round((z - a) / 12))); for (let q = 0; q < cnt; q++) b += arrow(a + (q + .5) * (z - a) / cnt, yS - 14, yS - 1); });
    b += '<rect x="' + xs[0].toFixed(1) + '" y="' + yS + '" width="' + (xs[n] - xs[0]).toFixed(1) + '" height="8" rx="1.5" style="fill:var(--ln)" stroke="#8FA39C"/>';
    for (let j = 0; j <= n; j++) { const w = Math.max(5, sc * S.c1[j] / 1e3); if (S.Ha[j] > 0) b += '<rect x="' + (xs[j] - w / 2).toFixed(1) + '" y="' + (yS - 20) + '" width="' + w.toFixed(1) + '" height="20" fill="#8FA39C"/>'; if (S.Hb[j] > 0) b += '<rect x="' + (xs[j] - w / 2).toFixed(1) + '" y="' + (yS + 8) + '" width="' + w.toFixed(1) + '" height="22" fill="#8FA39C"/>'; b += Tx(xs[j], yS + 42, nm(j), { c: CY2, w: 700, s: 9 }); }
    return b;
  }
  function diagrams(R) {
    const S = R.S, n = R.n, W = 340, A = 16, B = W - 16, tot = R.X0[n], sc = (B - A) / tot, xs = R.X0.map(x => A + x * sc), E = R.env;
    let b = frameBase(S, R.X0, xs, sc, 44);
    S.L.forEach((l, i) => { b += Tx((xs[i] + xs[i + 1]) / 2, 22, f(R.rows[i].wu, 1) + ' kN/m', { c: GRN, s: 7.5, w: 700 }); });
    const bY = 128, bH = 34, Mm = Math.max(1e-9, ...E.Mx.flat().map(Math.abs), ...E.Mn.flat().map(Math.abs)), mk = bH / Mm;
    b += Tx(A, 80, 'Bending moment envelope  M  (kNm)', { a: 'start', c: RED, w: 700, s: 9 }) + '<path d="M' + A + ' ' + bY + 'H' + B + '" stroke="var(--mu)" stroke-width=".8"/>';
    S.L.forEach((l, i) => { for (const arr of [E.Mx[i], E.Mn[i]]) { const pts = arr.map((v, t) => (xs[i] + l * sc * t / N).toFixed(1) + ',' + (bY + v * mk).toFixed(1)); b += '<polygon points="' + xs[i].toFixed(1) + ',' + bY + ' ' + pts.join(' ') + ' ' + xs[i + 1].toFixed(1) + ',' + bY + '" fill="rgba(239,68,68,.16)" stroke="' + RED + '" stroke-width="1.4" stroke-linejoin="round"/>'; } });
    for (let j = 0; j <= n; j++) { b += '<path d="M' + xs[j].toFixed(1) + ' 86V' + (bY + bH + 6) + '" stroke="var(--mu)" stroke-width=".5" stroke-dasharray="2 3"/>'; const v = Math.min(j > 0 ? R.rows[j - 1].MR : 0, j < n ? R.rows[j].ML : 0); if (v < -0.005 * Mm) b += Tx(Math.min(B - 8, Math.max(A + 8, xs[j])), bY + v * mk - 4, f(v, 1), { c: RED, s: 8, w: 700 }); }
    R.rows.forEach((r, i) => { if (r.Mp > 0.005 * Mm) b += Tx(xs[i] + r.xm * sc, bY + r.Mp * mk + 10, f(r.Mp, 1), { c: RED, s: 8, w: 700 }); });
    const vY = 232, vH = 34, Vm = Math.max(1e-9, ...E.Vx.flat().map(Math.abs), ...E.Vn.flat().map(Math.abs)), vk = vH / Vm;
    b += Tx(A, 184, 'Shear force envelope  V  (kN)', { a: 'start', c: YEL, w: 700, s: 9 }) + '<path d="M' + A + ' ' + vY + 'H' + B + '" stroke="var(--mu)" stroke-width=".8"/>';
    S.L.forEach((l, i) => { for (const arr of [E.Vx[i], E.Vn[i]]) { const pts = arr.map((v, t) => (xs[i] + l * sc * t / N).toFixed(1) + ',' + (vY - v * vk).toFixed(1)); b += '<polygon points="' + xs[i].toFixed(1) + ',' + vY + ' ' + pts.join(' ') + ' ' + xs[i + 1].toFixed(1) + ',' + vY + '" fill="rgba(245,197,24,.22)" stroke="' + YEL + '" stroke-width="1.4" stroke-linejoin="round"/>'; } b += Tx(xs[i] + 3, vY - R.rows[i].VL * vk - 3, f(R.rows[i].VL, 1), { a: 'start', c: YEL, s: 8, w: 700 }) + Tx(xs[i + 1] - 3, vY - R.rows[i].VR * vk + 10, f(R.rows[i].VR, 1), { a: 'end', c: YEL, s: 8, w: 700 }); });
    xs.forEach(x => { b += '<path d="M' + x.toFixed(1) + ' 190V' + (vY + vH + 6) + '" stroke="var(--mu)" stroke-width=".5" stroke-dasharray="2 3"/>'; });
    S.L.forEach((l, i) => { b += Tx((xs[i] + xs[i + 1]) / 2, vY + vH + 14, 'span ' + (i + 1) + ' · ' + f(l, 2) + ' m', { s: 7.5 }); });
    return '<svg viewBox="0 0 ' + W + ' 290" width="100%" role="img" aria-label="Equivalent frame, moment and shear envelopes">' + b + '</svg>';
  }
  function detail(D) {
    const S = D.S, R = D.R, n = D.n, W = 340, A = 16, B = W - 16, sc = (B - A) / R.X0[n], xs = R.X0.map(x => A + x * sc), yS = 60;
    let b = Tx(A, 12, 'Elevation (schematic)', { a: 'start', c: GRN, w: 700, s: 9 });
    for (let j = 0; j <= n; j++) { const w = Math.max(5, sc * S.c1[j] / 1e3); if (S.Ha[j] > 0) b += '<rect x="' + (xs[j] - w / 2).toFixed(1) + '" y="' + (yS - 26) + '" width="' + w.toFixed(1) + '" height="26" fill="#8FA39C" fill-opacity=".7"/>'; if (S.Hb[j] > 0) b += '<rect x="' + (xs[j] - w / 2).toFixed(1) + '" y="' + (yS + 16) + '" width="' + w.toFixed(1) + '" height="26" fill="#8FA39C" fill-opacity=".7"/>'; }
    b += '<rect x="' + xs[0].toFixed(1) + '" y="' + yS + '" width="' + (xs[n] - xs[0]).toFixed(1) + '" height="16" rx="2" style="fill:var(--ln)" stroke="#8FA39C"/>';
    D.spans.forEach((s, i) => { b += '<path d="M' + (xs[i] + 3).toFixed(1) + ' ' + (yS + 13) + 'H' + (xs[i + 1] - 3).toFixed(1) + '" stroke="' + GRN + '" stroke-width="1.8"/>' + Tx((xs[i] + xs[i + 1]) / 2, yS + 62, s.cs.S.txt + ' / ' + s.ms.S.txt, { c: GRN, s: 7, w: 700 }); });
    D.det.forEach((x, j) => { const l = x.left ? x.left.x * sc : 0, r = x.right ? x.right.x * sc : 0; b += '<path d="M' + (xs[j] - l).toFixed(1) + ' ' + (yS + 3) + 'H' + (xs[j] + r).toFixed(1) + '" stroke="' + CY + '" stroke-width="1.8"/><path d="M' + (xs[j] - l).toFixed(1) + ' ' + (yS + 3) + 'v5M' + (xs[j] + r).toFixed(1) + ' ' + (yS + 3) + 'v5" stroke="' + CY + '" stroke-width="1.4"/>' + Tx(xs[j], yS - 30, nm(j), { c: CY2, w: 700, s: 9 }); if (D.punch[j].links) b += '<rect x="' + (xs[j] - 7).toFixed(1) + '" y="' + (yS - 6) + '" width="14" height="28" fill="none" stroke="' + AMB + '" stroke-width="1.3" stroke-dasharray="2 2"/>'; });
    b += Tx(A, yS + 76, 'green = bottom bars · cyan = top bars · amber dashed = punching links', { a: 'start', s: 7 });
    // plan
    const pY = 176, pH = 60; b += Tx(A, pY - 14, 'Plan of the frame strip: column strip (green) · middle strip', { a: 'start', c: GRN, w: 700, s: 9 });
    D.spans.forEach((s, i) => { const x = xs[i], w = xs[i + 1] - xs[i], cs = pH * s.bcs / s.b; b += '<rect x="' + x.toFixed(1) + '" y="' + pY + '" width="' + w.toFixed(1) + '" height="' + pH + '" fill="none" stroke="#8FA39C"/><rect x="' + x.toFixed(1) + '" y="' + (pY + (pH - cs) / 2).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + cs.toFixed(1) + '" fill="rgba(18,194,107,.16)" stroke="' + GRN + '" stroke-dasharray="3 2"/>' + Tx(x + w / 2, pY + pH / 2 + 3, 'CS ' + f(s.bcs, 2) + ' m', { c: GRN, s: 7.5, w: 700 }) + Tx(x + w / 2, pY + 9, 'MS ' + f(s.bms / 2, 2) + ' m', { s: 7 }) + Tx(x + w / 2, pY + pH - 3, 'MS ' + f(s.bms / 2, 2) + ' m', { s: 7 }); });
    for (let j = 0; j <= n; j++) { const w = Math.max(5, sc * S.c1[j] / 1e3), h = Math.max(5, 0.5 * sc * S.c2[j] / 1e3 * 1.8); b += '<rect x="' + (xs[j] - w / 2).toFixed(1) + '" y="' + (pY + pH / 2 - h / 2).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '" fill="#8FA39C"/>'; }
    return '<svg viewBox="0 0 ' + W + ' 250" width="100%" role="img" aria-label="Flat slab detailing: elevation and plan">' + b + '</svg>';
  }
  function punchSvg(p, dsg) {
    const W = 340, H = 200, cx = 170, cy = 100, d = p.dp, l = p.links, ext = (l ? l.alast + d : 2 * d + 80) + Math.max(p.c1, p.c2) / 2, sc = Math.min(1, 86 / ext) * 0.0; /* placeholder, replaced below */
    const R = (l ? l.alast + 0.5 * d : 2 * d) + 0.6 * Math.max(p.c1, p.c2), k = 88 / Math.max(R, 1), hx = p.c1 / 2 * k, hy = p.c2 / 2 * k;
    const edge = p.pos !== 'Interior', corner = p.pos === 'Corner';
    let b = '<defs><clipPath id="pcl"><rect x="' + (edge ? cx - hx : 0) + '" y="' + (corner ? cy - hy : 0) + '" width="' + W + '" height="' + H + '"/></clipPath></defs>';
    const ring = (a, col, dash) => { const aa = a * k; return '<rect x="' + (cx - hx - aa).toFixed(1) + '" y="' + (cy - hy - aa).toFixed(1) + '" width="' + (2 * hx + 2 * aa).toFixed(1) + '" height="' + (2 * hy + 2 * aa).toFixed(1) + '" rx="' + aa.toFixed(1) + '" fill="none" stroke="' + col + '" stroke-width="1.2" ' + (dash ? 'stroke-dasharray="4 3"' : '') + '/>'; };
    b += '<g clip-path="url(#pcl)"><rect x="0" y="0" width="' + W + '" height="' + H + '" fill="var(--cd)"/>' + ring(2 * d, CY2, true) + ring(0, 'var(--mu)', false);
    if (l) { const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [.7071, .7071], [-.7071, .7071], [.7071, -.7071], [-.7071, -.7071]]; dirs.forEach(u => { const p0 = [u[0] === 0 ? 0 : Math.sign(u[0]) * hx, u[1] === 0 ? 0 : Math.sign(u[1]) * hy]; const e = l.alast * k; b += '<path d="M' + (cx + p0[0]).toFixed(1) + ' ' + (cy + p0[1]).toFixed(1) + 'L' + (cx + p0[0] + e * u[0]).toFixed(1) + ' ' + (cy + p0[1] + e * u[1]).toFixed(1) + '" stroke="' + AMB + '" stroke-width=".8"/>'; for (let q = 0; q < l.nP; q++) { const a = (0.5 * d + q * l.sr) * k; b += '<circle cx="' + (cx + p0[0] + a * u[0]).toFixed(1) + '" cy="' + (cy + p0[1] + a * u[1]).toFixed(1) + '" r="2.4" fill="' + AMB + '"/>'; } }); }
    b += '</g><rect x="' + (cx - hx).toFixed(1) + '" y="' + (cy - hy).toFixed(1) + '" width="' + (2 * hx).toFixed(1) + '" height="' + (2 * hy).toFixed(1) + '" fill="#8FA39C"/>';
    if (edge) b += '<path d="M' + (cx - hx) + ' ' + (corner ? cy - hy : 0) + 'V' + H + '" stroke="' + RED + '" stroke-width="1.6"/>' + Tx(cx - hx + 4, 12, 'free edge', { a: 'start', c: RED, s: 7.5 });
    b += Tx(W - 8, 14, 'u1 at 2d (dashed)', { a: 'end', c: CY2, s: 8, w: 700 }) + Tx(W - 8, 26, l ? '● ' + l.legs + ' legs/perimeter · ' + l.nP + ' perimeters · sr = ' + f(l.sr, 0) + ' mm' : 'no links required', { a: 'end', c: l ? AMB : GRN, s: 8, w: 700 });
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="Punching control perimeters and links">' + b + '</svg>';
  }

  root.SL_FLAT = { efm, design, steps, diagrams, detail, punchSvg, f, nm, N };
  if (typeof module !== 'undefined') module.exports = root.SL_FLAT;
})(typeof window !== 'undefined' ? window : globalThis);
