# rixochixo-site

Code and data behind the interactive pieces on [rixochixo.com](https://rixochixo.com).

## shake.js — Shake the building

A uniform N-story elastic shear frame you can run under real earthquake records.

- **Period:** Ta = Ct·hn^x, ASCE 7-22 §12.8.2.1 (Table 12.8-2 coefficients).
- **Time history:** Newmark average acceleration, 5% Rayleigh damping (modes 1 and 2), 0.005 s steps.
- **Response spectrum check:** 5% spectra of each record (RSAGOD method: Duhamel integral over 300 periods, 0.01–10 s), modal RSA with SRSS over the first five modes.
- **Ground motions (`gm/`):** 15 PEER NGA-West2 records, both horizontal components, scaled and resampled to 0.04 s, in g. From a CE 5515 project with Mehdi Samimy.

Elastic and idealized. Not for design.

## home/ — rixochixo.com home v3 (2027)

- `hero3d.js`: SCAN_01, a live point-cloud splat + depth mesh of Mateo (three.js r170). Move to look, drag to orbit, click to break it apart; SPLAT / MESH / DEPTH modes.
- `me.bin` / `wire.bin`: made from one video frame by `site/home-v3/scan.py` (Depth Anything V2 small, run locally).
- `home.css` / `home.js`: the page layer (blueprint field, grain, HUD type, decode headline, reveals, card spotlight, cursor).
