# tests

All run against `build/t4-node.js` (`./build.sh --node`).

- `run-btl.mjs <file.btl>` — boot a bootable, drive it in quanta, print output and MIPS.
- `equiv.mjs <file.btl> [reference.txt] [args]` — run twice; exit 0 only if both runs give identical output and instruction counts; compare with a native reference text if given.
- `occ.mjs <workdir> <d7205-root>` — the period toolset (oc → ilink → occonf → icollect) inside the emulator, then run the result. Needs an extracted `d7205a.tar.gz` (not in this repo).
- `fabric-node.mjs <prog.btl> <prog.map> [outdir] [keys]` — a configured multi-transputer bootable on the lockstep fabric, in-process. `Q=<instr>` sets the quantum.

Recorded 2026-09-21 on an M4 Pro (observed):

| program | nodes | quanta | msgs | bytes | host | result |
|---|---|---|---|---|---|---|
| `savage.b8h` | 1 | — | — | — | 25 ms | output identical to native |
| `raytrace3.btl` | 3 | 72,239 | 35,227 | 759,941 | 22 s | `ray.mtv` sha1 `dc28ff6f2ac54fdc3648a9f086720cdacb30b06f` = native |
| `raytrace6.btl` | 6 | 29,853 | 60,466 | 1,244,379 | 23 s | same sha1 |
| `raytrace18.btl` (browser, Workers) | 18 | — | 195,502 | 3,383,971 | 24 s | same sha1 |
| `raytrace64.btl` (62 workers; configured with the toolset inside the emulator) | 64 | 100,545 | 2,227,799 | 16,179,899 | 80 s | same sha1 |
| `ray6-altchain.btl` (same program wired on links 3→0) | 6 | 29,853 | 60,466 | 1,244,379 | 35 s | same sha1 |
| `ray6-ring.btl` (chain closed into a ring on links 2→3) | 6 | 30,049 | 59,337 | 1,232,326 | 35 s | same sha1 |

Two consecutive 3-node runs: identical quanta, messages, bytes and image.
