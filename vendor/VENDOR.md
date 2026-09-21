# vendored: pahihu/t4

Upstream: https://github.com/pahihu/t4 at commit `2f1bade58941c8e8f810a260d933b77714288bae` (2023-07-10), BSD-4-clause (see t4/COPYRIGHT, Julian Highfield 1993–1996; later work by pahihu).
Removed from the snapshot: `bin/` (prebuilt binaries), `mac/`, `t4.sln`.
Loom's changes are confined to `#ifdef T4WEB` blocks and the new file `webterm.c`; every change is a commit in this repository after the snapshot commit.
The INMOS toolset images upstream bundles (`itools/d7205/d7205a.tar.gz`, `itools/d7214/d7214c.tar.gz`) are **not in this repository** — removed from history before it went public (see LICENSING.md). The wrapper scripts in `itools/` remain. For local testing, fetch the tarballs from upstream and place them there; `.gitignore` keeps them out.
