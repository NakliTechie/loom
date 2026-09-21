/* Loom: terminal shim for the browser build (replaces curterm.c under T4WEB).
 * Keys arrive from the page. If the Worker was given a SharedArrayBuffer key
 * queue (cross-origin isolated page), getkey() blocks on Atomics.wait and the
 * transputer sees a real keyboard. Without one, has_key() is never true and
 * SP_GETKEY returns an error packet, which is what the toolset expects anyway. */
#include <emscripten.h>
#include "curterm.h"

EM_JS(int, loom_has_key, (void), {
        return (typeof Module.loomHasKey === 'function') ? (Module.loomHasKey() ? 1 : 0) : 0;
});
EM_JS(int, loom_get_key, (void), {
        return (typeof Module.loomGetKey === 'function') ? Module.loomGetKey() : -1;
});

void prepterm (int enable) { (void)enable; }
int  has_key (void) { return loom_has_key (); }
int  getkey (void) { return loom_get_key (); }
void kbflush (void) {}
int  has_ctrlc (void) { return 0; }
void cbreak (int enable) { (void)enable; }
void gotoxy (int x, int y) { (void)x; (void)y; }
void clrscr (void) {}
