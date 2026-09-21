# machines — facts sheet (2026-09-21)

Sources: Wikipedia *Meiko Scientific*, *Edinburgh Concurrent Supercomputer*, *Parsytec* (wikitext fetched 2026-09-21); R. N. Ibbett's Edinburgh comp-arch pages on the Computing Surface; Wallace 1990 (cited by Wikipedia, not read). Note [7] in the History tab points here.

## Meiko Computing Surface (CS-1)
- Founded 1985 by a group who left INMOS; demonstrated July 1985 (SIGGRAPH), on sale Q3 1986. T414 first, T800 as soon as available.
- "Multiple boards containing transputers connected together by their communications links via Meiko-designed link switch chips." A Module = up to 40 boards in two 19-inch racks; all inter-board links routed via the backplane; Supervisor bus with a Local Host board as bus master; modules chained by inter-module link boards; 3.1 kW each.
- Edinburgh Concurrent Supercomputer: 40-transputer pilot April 1986; large T800 system commissioned end 1987; ~400 processors at peak; SPARC-hosted with ~380 T800 from Oct 1992; decommissioned Aug 1994.
- Software: OPS (Meiko's version of INMOS D700 TDS), MultiOPS, M²VCS, MeikOS.
- Model here: 64 T800 as 16 boards × 4 in one module; every link hop goes through the backplane switch (map: chain on links 3→0).

## Parsytec GCel / GC-1 (Aachen, 1992)
- Parsytec founded 1985 in Aachen. GC ("GigaCluster/GigaCube") family: T9000 planned, T805 delivered.
- GigaCube = 4 clusters × 16 T805 (30 MHz, up to 4 MB each) + a redundant 17th T805 + four INMOS C004 link-routing chips per cluster; each T805 linked to a different C004 for fault tolerance. GC-1 = 64 CPUs = one GigaCube; GC-3 = 1024 (TOP500 1992, water-cooled above GC-3; ~27 kW, ~1 t, ~1.5 M DM in 1992).
- Hosted by a SUN workstation; software PARIX.
- Model here: 64 = 4 clusters × 16; hops inside a cluster via its C004s (links 2→1), hops between clusters via inter-cluster links (3→0).

## PARAM 8000 (Pune, 1991) — as before
- 64 T800-class nodes through a reconfigurable switch; model: 8×8 array, chain 2→1.

The raytracer is identical on all three (sha1 dc28ff6f…): verified 18 nodes each, 2026-09-21.
