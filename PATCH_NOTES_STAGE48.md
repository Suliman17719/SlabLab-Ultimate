# Stage 48 — Flat Slabs (Equivalent Frame Method + EC2 design)

## Home
Four slab tiles (2×2): One Way Slabs · Two Way Slabs · Irregular Slabs · **Flat Slabs**. The One-way / Two-way / Irregular screens also have a "Flat" switch.

## Flat slab workflow (new `flatslab.js`, UI in `app.js`)
1. Enter the equivalent frame: spans (L, l2, h, gk, qk — empty gk/qk = Project-setup loads), columns (c1, c2, H above/below, Interior/Edge/Corner), analysis options (far ends, torsion, axial deformation, service factors).
2. Live frame sketch with moment (red) and shear (yellow) envelopes of load cases A, B, C.
3. Choose the share of the hogging / sagging moment that goes to the column strip (middle strip gets the rest; EC2 Annex I 60–80 % / 50–70 % is flagged, not enforced) and the design basis: **maximum values** (max M⁺, M⁻, V for every span) or **each span**.
4. Design per strip zone: flexure (K, K′, z, As,req, As,min/max), bar selection, spacing limits, crack control (Table 7.3N), one-way shear (6.2.2), **punching shear (6.4)** for every column with β, u0/u1, vRd,max, vRd,c, shear links (number of legs / perimeters), edge-column moment transfer, span/depth deflection (7.4.2), anchorage at end columns, contraflexure-based top-bar lengths.
5. Results, **14 solution steps**, mini detailing (elevation, strip plan, punching perimeters and links) and "Save to project".

Files: flatslab.js (new), app.js, index.html, sw.js (cache stage48), style.css.
Limits: single direction (frame) is designed; the orthogonal direction is assumed to have the same steel for ρl; edge/corner β uses the EC2 Fig. 6.21N simplified values; kmax = 1.5 for punching with links. Verify independently before use.
