/* Loom: the exported surface of one emulated transputer.
 *   t4_run(budget)  -> 0 budget spent, 1 server exit, 2 halted on error
 *   t4_instr()      -> instructions executed since boot (the virtual clock)
 *   t4_cleanup()    -> flush files after a stop (defined in main.c)
 * Booting is main(argv) as upstream: t4 -se -sb file.btl [args]. */
#include <stdint.h>
#include <emscripten.h>

extern uint64_t ml_budget, ml_instr;
extern int ml_halted;
void mainloop (void);
void t4_cleanup (void);

EMSCRIPTEN_KEEPALIVE int t4_run (double budget)
{
        if (ml_halted) return ml_halted;
        ml_budget = (uint64_t)budget;
        mainloop ();
        return ml_halted;
}
EMSCRIPTEN_KEEPALIVE double t4_instr (void) { return (double)ml_instr; }
EMSCRIPTEN_KEEPALIVE int t4_halted (void) { return ml_halted; }
EMSCRIPTEN_KEEPALIVE void t4_finish (void) { t4_cleanup (); }
