# Cray X-MP — work in progress (Batch X)

Working clone: `~/Code/cray/cray-sim` (andrastantos/cray-sim, HSNCL non-commercial licence — see plan/cray-scope.md) and `~/Code/cray/COS-Tools` (Apache-2.0). Neither is vendored yet; this folder holds what is needed to reproduce today's state on the clone:

- `cray-sim-macos.patch` — build fixes for macOS/clang/Boost 1.92: `io_context.restart()`, no CPU affinity, Darwin link flags, `size_t`/`long` config translators (this one matters: without it `0x...` addresses in the config silently fail to parse and the sim asserts at startup). Apply with `git apply` in the clone.
- `vtap_none.cpp` — TAP networking stub (no Ethernet on macOS/wasm); the patch selects it on Darwin.
- `cos_headless.cfg` — `cos_117.cfg` with the xterm spawning disabled; consoles listen on 20000 (station), 20003 (IOP0 kernel), 20004–20006 (other IOPs), 9000 (httpd).
- `build_exp_disk_helloa` — disk build including `BIN/HELLOA` (CAL hello assembled with COS-Tools `cal`/`ldr`; `make COS_BASE=<COS-Tools>/ -C examples/helloa` first — the bare `cal` name collides with `/usr/bin/cal`).
- `session.py`, `con.py` — telnet drivers for the consoles.

Build: `cd simulator && CPATH=/opt/homebrew/include LIBRARY_PATH=/opt/homebrew/lib make SYSTEM=linux GCXX=clang++ GCC=clang MODE=release OBJCOPY=true STRIP=true build`.

State on 2026-09-21 (observed): IOS kernel boots (`IOP-0 KERNEL, VERSION 4.2.2, Sn302/25`); `START COS_117 DEADSTART` reaches `START COMPLETE`, CPU0 ON; `STATION` + `LOGON` at port 20000 works; COS startup asks `ENTER CONFIGURATION CHANGES OR 'GO'` then `MD-1-20A UNABLE TO READ DEVICE LABEL … REPLY 'LABEL'`. Not yet done: the reply sequence through to `STARTUP COMPLETE` (my driver mis-parsed message numbers), the `IAIOP LOG` / `IAC` interactive session (reported `CPU NOT RESPONDING` and logged the station off), running HELLOA. Next: drive the station by hand in tmux once to learn the exact sequence, then script it.
