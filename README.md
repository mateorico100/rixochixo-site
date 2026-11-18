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

- `hero3d.js`: FILE 001, a live full-head point cloud + depth mesh of Mateo in shirt and tie (three.js r170). Drag to turn it all the way round; POINTS / MESH / DEPTH modes. Composed motion ("James Bond, not crazy").
- `me.bin` / `wire.bin`: made by `site/home-v3/scan.py` (Depth Anything V2 small, run locally): front from the Mar 2024 portrait with his current beard composited in (`beard.py`), back and sides shaped and textured from a Nov 2026 side-profile photo.
- `home.css` / `home.js`: the page layer (blueprint field, HUD type, headline settle, reveals, card spotlight).
