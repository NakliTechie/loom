# PARAM / Loom — a transputer supercomputer in a browser tab

Artifact 2 of the PARAM strand. pahihu's `t4` (Julian Highfield's INMOS T414/T800 emulator, BSD) compiled to WebAssembly and run in a Worker on a **virtual clock**: 10 instructions per microsecond, every run deterministic. The 1990 INMOS D7205A occam 2 toolset runs *inside* the emulated transputer, so a `.occ` file becomes a real transputer bootable without any compiler of ours.

Live: **https://param.naklitechie.com** — the story (1987 refusal → PARAM 8000 → the numbers → the export-control chart), a lit schematic of the 64-node machine, then the workbench. The long essay is at `/piece/` (its own repo, [param](https://github.com/NakliTechie/param), reached through a service binding); numbers in [param-fp64](https://github.com/NakliTechie/param-fp64).

## The page

Five tabs: **History** (the 1987 refusal, the 1991 machine) · **The machine** (a lit schematic of the 64-node PARAM 8000 and seven period programs that run on click — hello, primes, knight's tour, Whetstone, Dhrystone, the INMOS raytracer on 6/18/64 nodes, and MINIX 1.5 booting to a shell) · **Numbers** (the benchmark table) · **The line** (the export-control chart) · **Workbench** (disk, console, fabric view, build-from-occam). Bootables are in `site/demo/`; all are INMOS-toolset or INMOS-C output and are the same files the upstream t4 repository publishes.

## v1.0 — one node

- `site/` — static page (Dense direction), `worker.js` (one T800 per Worker), `t4.js` + `t4.wasm` (131 KB, committed so the deploy needs no emsdk), `tar.js`, `traces/`.
- Drop a `.btl` and run it. Drop `d7205a.tar.gz` (your copy — see [LICENSING.md](LICENSING.md)) plus a `.occ` and **build** runs `oc → ilink → occonf → icollect` inside the transputer, then run.
- Keyboard input reaches the transputer through a SharedArrayBuffer ring when the page is cross-origin isolated (`site/_headers` sets COOP/COEP).
- Agent face: `window.loom` — `load(name, bytes)`, `fetchInto(url)`, `select`, `run(path)`, `build(path)`, `text(path)`, `console()`, `disk`, `runs`. The buttons call the same functions.

## Build the emulator

```
./build.sh            # → site/t4.js, site/t4.wasm (Worker build)
./build.sh --node     # → build/t4-node.js for the tests
node tests/run-btl.mjs vendor/t4/examples/hello/hello.btl
node tests/occ.mjs <dir with hello.occ/.pgm/.lah> <extracted d7205 root>
```

Emscripten 6.x. Changes to upstream are confined to `#ifdef T4WEB` blocks plus `webterm.c` / `web.c` (`vendor/VENDOR.md`).

## Known gaps (v1.0)

- WebAssembly has no FPU exception flags and no directed rounding: overflow / divide-by-zero / invalid are detected from results on binary operations; `fprp` / `fprm` / `fprz` round to nearest. SoftFloat is the fix, not scheduled.
- One node. The fabric (2–64 nodes, topology presets, visible channel traffic) is v1.1.
- Cycle accuracy is an upstream non-goal and not claimed.

## Local preview

`python3 serve.py 8767` serves `site/` with the COOP/COEP headers and maps `/fixtures/` to `vendor/t4` for driving tests.

This product includes software developed by Julian Highfield.

## Deploy

Static-assets Worker `loom`, custom domain `loom.naklitechie.com`, `site/_headers` carries COOP/COEP. Preferred: Cloudflare Workers Builds connected to `NakliTechie/loom` (dashboard → Workers & Pages → loom → Settings → Build; no build command; deploy `npx wrangler deploy`). Fallback: `.github/workflows/deploy.yml`, gated on repo variable `DEPLOY_VIA_ACTIONS=true` + secret `CLOUDFLARE_API_TOKEN`. Manual: `npx wrangler deploy`.
