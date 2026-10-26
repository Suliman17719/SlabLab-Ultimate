# SlabLab · Stage 49

## 1 · What is new
| # | Request | Result |
|---|---------|--------|
| 1 | EFM diagrams show the whole frame | `flatslab.js → diagrams()` redrawn: slabs **and** columns (above/below), loads, BMD with column end moments, SFD with column shear and axial load N. Column values labelled. |
| 2 | Punching-shear audit | See section 3. |
| 3 | Crack-control audit (all slabs) | See section 4 — one real bug and one limit corrected. |
| 4 | Two new lessons | `lessons-extra.js`: **Equivalent Frame** and **Punching Shear**, each *Concept* (15 animated slides) + *Worked example* (13 slides). Numbers come from the app engines. Learn now has 8 topics / 16 lessons. |
| 5 | Multi-Slab Project | Home card → create projects, add one-way / two-way / irregular / flat slabs, summary banner (`4 slabs out of 5 passed ❗` / `All 5 slabs passed ✅`) and a final-reinforcement table. |
| 6 | ACI 318-25 route | After **Calculate** an **Analysis** screen appears with two buttons: **Run Design by EC2** (green) and **Run Design by ACI 318-25** (cyan). Full ACI design for the four slab types (`aci-design.js`). |

## 2 · ACI 318-25 design — scope and assumptions
Clause numbers are those of ACI CODE-318-25 (checked against the PDF supplied).
* **Loads** 5.3.1: U = max(1.4D ; 1.2D + 1.6L) — factors editable in *Project setup → Loads*.
* **Flexure** 22.2/22.3, φ = 0.9 with a tension-controlled check (εt ≥ εty + 0.003, 7.3.3.1 / 8.3.3.1); As,min = 0.0018·Ag (7.6.1.1 / 8.6.1.1).
* **Spacing / crack control** — one-way: Table 24.3.2 with fs = 2/3·fy and 7.7.2.3 (3h, 450); two-way and flat: 8.7.2.2 (2h, 450). Distribution steel 0.0018·Ag, s ≤ min(5h, 450).
* **One-way slabs** — ACI 6.5 simplified method (Table 6.5.2 / 6.5.4, with the 6.5.1 applicability checks) or the elastic strip; shear 22.5.5.1 with size effect λs; min. thickness Table 7.3.1.1 and, if not met, calculated deflection (24.2.3.5 Ie, ℓ/360 and ℓ/240); anchorage 25.4.2.3, 25.4.3, 9.7.3.8.3.
* **Two-way / irregular** — panel moments from the Analysis stage are linear in the load and are scaled by wu(ACI)/n(EC2) (ACI 8.2.1 allows any equilibrium-satisfying analysis). Min. thickness 8.3.1.1 / 8.3.1.2 (αfm from the support beams, T-beam flanges per 8.4.1.8), corner reinforcement 8.7.3. Irregular slabs: deflection must be verified separately.
* **Flat slabs** — EFM with ACI 6.4.3 pattern loading (75 % L), hogging moments at the column face (≤ 0.175ℓ), strip shares per 8.10.5 (75 % / 100 % / 60 %) or the user's %, one-way shear, min. thickness 8.3.1.1, bottom-bar anchorage at end columns (1.25fy, 8.7.4.2.2), bar extensions (Fig. 8.7.4.1.3).
* **Punching** 22.6 + 8.4.4: critical section at d/2 (interior / edge / corner), γf and γv, Jc by the R8.4.4.2.3 convention, Msc moved to the section centroid (Msc − Vu·g), vc = min of Table 22.6.5.2 (a)(b)(c), stirrups (22.6.6–22.6.7, 8.7.6), outer section, moment transfer by flexure in c2 + 3h and the 8.6.1.2 minimum.
* **Not implemented**: ACI Direct Design Method, drop panels / column capitals, Table 8.4.2.2.4 edge-column modifications (conservative), the EFM stiffening of the slab-beam inside the joint (prismatic slab-beams are used), shear studs.

## 3 · Punching-shear audit (EC2 route, `flatslab.js`)
Each formula was re-derived and compared with a separate hand calculation (`tests/test-stage49.js`, interior column, 4-span example):
u0, u1 = u0 + 4πd, W1, k (Table 6.1), β = 1 + k·MEd·u1/(VEd·W1), vRd,c with k ≤ 2, ρl ≤ 2 % and vmin, vRd,max = 0.4ν·fcd, Asw from VRd,cs, fywd,ef, outer perimeter u_out, spacing and last-line rules, edge / corner perimeters and the Mt,max check.
**No calculation error was found, so the EC2 punching numbers are unchanged.** Conservative simplifications that remain (documented, not changed):
* VEd = full column reaction (not reduced by the load inside the control perimeter);
* VEd and MEd are the maxima over the load cases (they may come from different cases);
* edge / corner columns use β = 1.4 / 1.5 (EC2 6.4.3(6)); only the frame direction is checked;
* ρl is taken from the larger column-strip top steel at the column, same in both directions.
I could only check against my knowledge of EN 1992-1-1 6.4 (the Eurocode text was not supplied).

## 4 · Crack-control audit (all slabs)
Fixed in `engine.js` (shared `crackCheck`, also used by `engine2.js` and the flat-slab module):
1. **Bug**: every slab with h ≤ 200 mm was reported *NOT OK*. EC2 7.3.3(1) exempts slabs in buildings with h ≤ 200 mm (bending, no significant tension) from a calculation, provided the 9.3 detailing rules hold → now OK with that statement.
2. **Limit**: main-bar spacing was limited to min(3h, 400); EC2 9.3.1.1(3) requires min(2h, 250) in zones of maximum moment → corrected (one-way, two-way, irregular).
3. **Flat slabs**: the service-load factor for Q now defaults to ψ2 = 0.3 (quasi-permanent combination, EC2 7.3.4) instead of 1.0; saved frames with 1.0 are migrated; the h ≤ 200 exemption is applied.
4. Verified unchanged: Table 7.3N values and interpolation, σs = fyd·(As,req/As,prov)·(q/n).

## 5 · Files
**Replace** (same name, same place): `app.js`, `engine.js`, `engine2.js`, `flatslab.js`, `style.css`, `index.html`, `sw.js`, `code-registry.js`
**Add (new)**: `aci-design.js`, `lessons-extra.js`, `tests/test-stage49.js`, `PATCH_NOTES_STAGE49.md`
**Unchanged**: `lessons.js`, `strip.js`, `aci318-25-engine.js`, `sbc304-2024-engine.js`, manifest, icons, fonts.
**Delete**: nothing is required. (Optional: older `PATCH_NOTES_STAGE*.md` files are history only.)
Run the regression: `node tests/test-stage49.js` (36 checks).
