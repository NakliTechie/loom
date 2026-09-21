# vendored: pahihu/t4

Upstream: https://github.com/pahihu/t4 at commit `2f1bade58941c8e8f810a260d933b77714288bae` (2023-07-10), BSD-4-clause (see t4/COPYRIGHT, Julian Highfield 1993–1996; later work by pahihu).
Removed from the snapshot: `bin/` (prebuilt binaries), `mac/`, `t4.sln`.
Loom's changes are confined to `#ifdef T4WEB` blocks and the new file `webterm.c`; every change is a commit in this repository after the snapshot commit.
The bundled `itools/d7205/d7205a.tar.gz` and `itools/d7214/` (INMOS toolsets) are kept in the snapshot for local testing only and are **not** published to the site (see LICENSING.md).
