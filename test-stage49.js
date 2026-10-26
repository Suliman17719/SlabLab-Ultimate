/* Stage 49 regression tests — run with:  node tests/test-stage49.js
   Independent hand calculations (written separately from the app code) compared with the engines. */
const E = require('../engine.js'), E2 = require('../engine2.js'), FL = require('../flatslab.js'), AC = require('../aci-design.js');
let pass = 0, fail = 0;
const close = (name, a, b, tol) => { const ok = Math.abs(a - b) <= (tol || 1e-6) * Math.max(1, Math.abs(b)); ok ? pass++ : (fail++, console.log('FAIL', name, a, 'expected', b)); };
const yes = (name, c) => { c ? pass++ : (fail++, console.log('FAIL', name)); };
const c = Object.assign({}, E.DEF), PI = Math.PI;

/* 1 · ACI flexure, hand calc: h = 200, cover 25, Ø12, Mu = 30 kNm/m, f'c = 25, fy = 460 */
{ const m = AC.mat(c), z = AC.flexZ(30, 200, c, m, 12, 'outer', 'one'), d = 200 - 25 - 6, Rn = 30e6 / (0.9 * 1000 * d * d), rho = 0.85 * 25 / 460 * (1 - Math.sqrt(1 - 2 * Rn / (0.85 * 25)));
  close('ACI As,req', z.Asr, rho * 1000 * d, 1e-9); yes('ACI tension-controlled', z.tc); yes('ACI phi 0.9', z.phi === 0.9);
  const fs = 2 / 3 * 460; close('ACI 24.3.2 spacing', z.scrack, Math.min(380 * 280 / fs - 2.5 * 25, 300 * 280 / fs), 1e-9); }
/* 2 · ACI one-way shear (22.5.5.1): lambda_s and Vc */
{ const m = AC.mat(c), d = 169, ls = Math.sqrt(2 / (1 + d / 250)), v = AC.Vc1(452, 1000, d, m); close('lambda_s', v.ls, Math.min(1, ls)); const rho = 452 / (1000 * d); close('Vc', v.Vc, Math.max(0.66 * Math.min(1, ls) * Math.cbrt(rho) * 5, 0.083 * 5) * 1000 * d / 1000, 1e-9); }
/* 3 · ACI 6.5 coefficients (one-way, end span with 3 spans, L = 4 m on 300 beams) */
{ const R = E.design({ cs: 'End span', L: 4000, bw: 300, hb: 500, spanCount: 3, Ll: 0, Lr: 4000 }, c), a = AC.oneWay(R, c), U = Math.max(1.4 * R.ld.Gk, 1.2 * R.ld.Gk + 1.6 * R.ld.Qk), ln = 3.7;
  close('ACI end span M+', a.Ms, U * ln * ln / 11, 1e-9); close('ACI end span M-', a.Mh, U * ln * ln / 10, 1e-9); close('ACI V', a.V, 1.15 * U * ln / 2, 1e-9); }
/* 4 · EC2 punching, independent interior-column calculation (EC2 6.4) on the 4-span example */
{ const S = { L: [6, 7.5, 7.5, 6], b: [5, 5, 5, 5], h: Array(4).fill(220), g: Array(4).fill(7), q: Array(4).fill(3), c1: Array(5).fill(350), c2: Array(5).fill(350), Ha: Array(5).fill(3.2), Hb: Array(5).fill(3.2), pos: ['Edge', 'Interior', 'Interior', 'Interior', 'Edge'] };
  const R = FL.efm(S, { gG: 1.35, gQ: 1.5, sG: 1, sQ: 0.3, fx: 4, tor: 1, ax: 1 }), D = FL.design(R, c, { basis: 'span', layer: 'outer', phi: 12, sn: 70, sp: 60 }), p = D.punch[1];
  const d = p.dp, c1 = 350, c2 = 350, u0 = 2 * (c1 + c2), u1 = u0 + 4 * PI * d, W1 = c1 * c1 / 2 + c1 * c2 + 4 * c2 * d + 16 * d * d + 2 * PI * d * c1, k = 0.6, beta = 1 + k * p.MEd * 1e6 / (p.VEd * 1e3) * u1 / W1, v = beta * p.VEd * 1e3 / (u1 * d);
  close('u1', p.u1, u1, 1e-9); close('W1', p.W1, W1, 1e-9); close('beta', p.beta, beta, 1e-9); close('vEd', p.v1, v, 1e-9);
  const kk = Math.min(2, 1 + Math.sqrt(200 / d)), rho = Math.min(0.02, p.rho), vrdc = Math.max(0.18 / 1.5 * kk * Math.cbrt(100 * rho * 25), 0.035 * Math.pow(kk, 1.5) * 5); close('vRd,c', p.vrdc, vrdc, 1e-9);
  /* equilibrium of the frame */ yes('EFM equilibrium', R.resOk); }
/* 5 · ACI punching: independent interior-column calculation */
{ const S = { L: [6, 7.5, 7.5, 6], b: [5, 5, 5, 5], h: Array(4).fill(220), g: Array(4).fill(7), q: Array(4).fill(3), c1: Array(5).fill(350), c2: Array(5).fill(350), Ha: Array(5).fill(3.2), Hb: Array(5).fill(3.2), pos: ['Edge', 'Interior', 'Interior', 'Interior', 'Edge'] };
  const R = FL.efm(S, { gG: 1.2, gQ: 1.6, sG: 1, sQ: 0.3, fx: 4, tor: 1, ax: 1, pat: 'aci' }), r = AC.flat(R, c, { basis: 'span', layer: 'outer', phi: 12, aciStrip: 'aci' }), p = r.punch[1], d = p.d, b1 = 350 + d, b0 = 4 * b1;
  const J = d * b1 ** 3 / 6 + b1 * d ** 3 / 6 + d * b1 * b1 * b1 / 2, gf = 1 / (1 + 2 / 3), gv = 1 - gf, Vu = p.Vcol - p.Uarea * b1 * b1 / 1e6, vuv = Vu * 1e3 / (b0 * d), vu = vuv + gv * p.Msc * 1e6 * (b1 / 2) / J;
  close('ACI b0', p.cs.b0, b0, 1e-9); close('ACI Jc', p.cs.J, J, 1e-9); close('ACI Vu', p.Vu, Vu, 1e-9); close('ACI vu', p.vu, vu, 1e-9);
  const ls = Math.min(1, Math.sqrt(2 / (1 + d / 250))), vc = Math.min(0.33, 0.17 + 0.33, 0.17 + 0.083 * 40 * d / b0) * ls * 5; close('ACI vc', p.vc, vc, 1e-9);
  /* edge-column section against McCormac Example (SI conversion): c = 381 mm, d = 171.45 mm */
  const s = AC.critSec('Edge', 381, 381, 171.45), a = 381 + 171.45 / 2; close('McCormac a', s.a, a, 1e-9); close('McCormac cAB', s.cIn, a * a / (2 * a + 381 + 171.45), 1e-6);
  const Jm = 171.45 * (2 * a ** 3 / 3 - (2 * a + 381 + 171.45) * (a * a / (2 * a + 381 + 171.45)) ** 2) + a * 171.45 ** 3 / 6; close('McCormac Jc', s.J, Jm, 1e-6); }
/* 6 · crack control rules (EC2 7.3.3(1) and 9.3.1.1(3)) */
{ [150, 200].forEach(h => { const R = E.design({ cs: 'Simply supported', L: 4000, bw: 300, hb: 500, hov: h }, c); yes('h <= 200 crack OK ' + h, /^OK/.test(R.cs.chk)); });
  const R = E.design({ cs: 'Simply supported', L: 4000, bw: 300, hb: 500, hov: 300 }, c); yes('h=300 spacing <= min(2h,250)', R.fs.sp <= 250);
  const R2 = E2.design2({ lx: 4000, ly: 5000, type: 1, bw: 300, hb: 500, hov: 180 }, c); yes('two-way h<=200 crack OK', /^OK/.test(R2.st.crack)); }
/* 7 · ACI efm pattern loading: 75 % of L, equilibrium for every case */
{ const S = { L: [5, 4, 5], b: [4, 4, 4], h: [170, 170, 170], g: [2, 2, 2], q: [5, 5, 5], c1: Array(4).fill(400), c2: Array(4).fill(250), Ha: Array(4).fill(4.5), Hb: Array(4).fill(4.5), pos: ['Edge', 'Interior', 'Interior', 'Edge'] };
  const R = FL.efm(S, { gG: 1.2, gQ: 1.6, sG: 1, sQ: 0.3, fx: 4, tor: 0, ax: 1, pat: 'aci' }); yes('ACI patterns generated', R.cases.length === 1 + 3 + 4); R.cases.forEach(k => yes('case equilibrium ' + k.id, Math.abs(k.r.res) < 1e-6)); }
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
