# Licensing — what Loom ships and what it does not

**The emulator.** `vendor/t4` is pahihu's t4, which carries Julian Highfield's 1993–1996 copyright notice under a BSD-4-clause licence (`vendor/t4/COPYRIGHT`). Redistribution in source and binary form is permitted with attribution and the advertising clause; this repository and the site carry the required notice: *This product includes software developed by Julian Highfield.* pahihu's later additions (macOS/Linux port, T800 FPU work, networking) carry no separate licence text in the repository; a courtesy note to the author is owed and recorded in plan/pending.

**The INMOS D7205A occam 2 toolset.** The compiler, linker, configurer and collector are INMOS programs from 1990, transputer bootables that run *inside* the emulator. Their rights passed through SGS-Thomson to STMicroelectronics and have never, to this repository's knowledge, been released. The toolset is archived at transputer.net and is bundled in the t4 repository, but *circulated* is not *licensed*. Loom therefore does **not** publish the toolset. The site ships the emulator and a file drop: a visitor who has a copy of `d7205a.tar.gz` (or the individual `*.btl` tools and `libs/`) drops it on the page and the toolchain runs in their tab. Nothing leaves the tab.

**Example bootables.** Programs compiled with the INMOS toolset link INMOS runtime libraries (`hostio.lib` and friends) and are therefore INMOS-derived. The site does not publish them either. The precomputed traces on the site are Loom's own data (instruction counts, console output, timing) and contain no INMOS code.

**The validation suite.** TVS1 / TVS1F (Mike Bruestle, transputer.net) are used for verification and are not redistributed here.

If a release or abandonment of the INMOS toolset rights can be established, the toolset ships and the file drop becomes optional. Until then the drop is the design.
