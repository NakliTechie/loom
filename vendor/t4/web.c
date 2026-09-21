/* Loom: the exported surface of one emulated transputer.
 *   t4_run(budget)   -> 0 budget spent (or yielded idle: see t4_idle), 1 server exit, 2 halted on error
 *   t4_idle()        -> 1 if the last t4_run returned because nothing was runnable
 *   t4_instr()       -> instructions executed since boot (the virtual clock); t4_set_instr() advances it
 *   t4_booting()     -> 1 while a worker node is waiting for its bootstrap on a link
 *   t4_links()       -> address of the links mirror (8 slots of T4_SCH_SIZE per node), 0 if none
 *   t4_finish()      -> flush files after a stop
 * Booting is main(argv) as upstream: t4 -s8 -se -sb file.btl (node 0) or t4 -s8 -sl -sn N (worker node). */
#include <stdint.h>
#include <emscripten.h>
#include "processor.h"

extern uint64_t ml_budget, ml_instr;
extern int ml_halted, ml_idle, ml_booting;
extern u_char *SharedLinks;
extern int nodeid;
void mainloop (void);
void t4_cleanup (void);
int  t4_boot_tail (void);

EMSCRIPTEN_KEEPALIVE int t4_run (double budget)
{
        if (ml_halted) return ml_halted;
        ml_idle = 0;
        if (ml_booting)
        {
                if (0 == linkcomms ("boot", 1, 0)) { ml_idle = 1; return 0; }
                t4_boot_tail ();
        }
        ml_budget = (uint64_t)budget;
        mainloop ();
        return ml_halted;
}
EMSCRIPTEN_KEEPALIVE int    t4_idle (void) { return ml_idle; }
EMSCRIPTEN_KEEPALIVE int    t4_booting (void) { return ml_booting; }
EMSCRIPTEN_KEEPALIVE double t4_instr (void) { return (double)ml_instr; }
EMSCRIPTEN_KEEPALIVE void   t4_set_instr (double v) { ml_instr = (uint64_t)v; }
EMSCRIPTEN_KEEPALIVE int    t4_halted (void) { return ml_halted; }
EMSCRIPTEN_KEEPALIVE int    t4_node (void) { return nodeid; }
EMSCRIPTEN_KEEPALIVE u_char *t4_links (void) { return SharedLinks; }
EMSCRIPTEN_KEEPALIVE int    t4_sch_size (void) { return SCH_SIZE; }
EMSCRIPTEN_KEEPALIVE void   t4_finish (void) { t4_cleanup (); }
