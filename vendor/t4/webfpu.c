/* Loom: directed rounding for the WebAssembly build.
 *
 * WebAssembly has no rounding-mode control, so fesetround() is a no-op there. The T800's
 * fprz / fprp / fprm instructions (used by the occam compiler for TRUNC, and by the
 * libraries) must still round the right way. This file computes each primitive in
 * round-to-nearest and then corrects the result to the required direction using an
 * exact error term: TwoSum for add/sub, fma() for mul/div/sqrt (fma is software on wasm
 * but exact; it only runs when the mode is not nearest, which is rare in compiled code).
 * REAL32 operands are promoted to double, where their sum/product/quotient error is
 * still exactly recoverable, then rounded to float in the requested direction.
 * Overflow to infinity under a directed mode is left at the round-to-nearest result
 * (the T800 flags the error either way). */
#include <math.h>
#include <stdint.h>
#include "fpiface.h"
#include "fparithmetic.h"

extern int RoundingMode;   /* ROUND_Z=1, ROUND_N=2, ROUND_P=3, ROUND_M=4 */

/* move x one ulp toward the direction the mode requires when the exact value is
 * (sign>0) above or (sign<0) below x. sign==0 means exact. */
static double fix64 (double x, int sign)
{
        if (sign == 0 || RoundingMode == ROUND_N || isnan (x) || isinf (x)) return x;
        if (RoundingMode == ROUND_Z) return (x > 0 && sign < 0) || (x < 0 && sign > 0) ? nextafter (x, x > 0 ? -INFINITY : INFINITY) : (x == 0 ? (sign > 0 ? 0.0 : -0.0) : x);
        if (RoundingMode == ROUND_P) return sign > 0 ? nextafter (x, INFINITY) : x;
        /* ROUND_M */                return sign < 0 ? nextafter (x, -INFINITY) : x;
}
static float fix32 (float x, int sign)
{
        if (sign == 0 || RoundingMode == ROUND_N || isnan (x) || isinf (x)) return x;
        if (RoundingMode == ROUND_Z) return (x > 0 && sign < 0) || (x < 0 && sign > 0) ? nextafterf (x, x > 0 ? -INFINITY : INFINITY) : (x == 0 ? (sign > 0 ? 0.0f : -0.0f) : x);
        if (RoundingMode == ROUND_P) return sign > 0 ? nextafterf (x, INFINITY) : x;
        return sign < 0 ? nextafterf (x, -INFINITY) : x;
}
static int sgn (double e) { return e > 0 ? 1 : e < 0 ? -1 : 0; }

/* exact double -> float in the current mode. `err` is the sign of (true value - d). */
static float to32 (double d, int err)
{
        float f = (float) d;                     /* round to nearest */
        if (RoundingMode == ROUND_N || isnan (f) || isinf (f)) return f;
        double back = (double) f;
        int sign = back == d ? err : sgn (d - back);
        return fix32 (f, sign);
}

/* ---- 64-bit ---- */
double t4w_add64 (double a, double b)
{
        double s = a + b;
        if (RoundingMode == ROUND_N) return s;
        double bb = s - a, e = (a - (s - bb)) + (b - bb);      /* TwoSum */
        return fix64 (s, sgn (e));
}
double t4w_sub64 (double a, double b) { return t4w_add64 (a, -b); }
double t4w_mul64 (double a, double b)
{
        double p = a * b;
        if (RoundingMode == ROUND_N) return p;
        return fix64 (p, sgn (fma (a, b, -p)));
}
double t4w_div64 (double a, double b)
{
        double q = a / b;
        if (RoundingMode == ROUND_N) return q;
        double r = fma (-q, b, a);                            /* a - q*b, exact */
        return fix64 (q, sgn (r) * (b < 0 ? -1 : 1));
}
double t4w_sqrt64 (double a)
{
        double s = sqrt (a);
        if (RoundingMode == ROUND_N) return s;
        return fix64 (s, sgn (fma (-s, s, a)));
}
double t4w_rint64 (double x)
{
        switch (RoundingMode) { case ROUND_Z: return trunc (x); case ROUND_P: return ceil (x); case ROUND_M: return floor (x); default: return rint (x); }
}
double t4w_i32_to_fp64 (int32_t i) { return (double) i; }       /* exact */
double t4w_u32_to_fp64 (uint32_t u) { return (double) u; }      /* exact */

/* ---- 32-bit, via double ---- */
float t4w_add32 (float a, float b)
{
        double s = (double) a + (double) b;
        if (RoundingMode == ROUND_N) return (float) s;
        double da = a, db = b, bb = s - da, e = (da - (s - bb)) + (db - bb);
        return to32 (s, sgn (e));
}
float t4w_sub32 (float a, float b) { return t4w_add32 (a, -b); }
float t4w_mul32 (float a, float b)
{
        double p = (double) a * (double) b;                    /* exact: 24+24 bits < 53 */
        return to32 (p, 0);
}
float t4w_div32 (float a, float b)
{
        double q = (double) a / (double) b;
        if (RoundingMode == ROUND_N) return (float) q;
        double r = fma (-q, (double) b, (double) a);
        return to32 (q, sgn (r) * (b < 0 ? -1 : 1));
}
float t4w_sqrt32 (float a)
{
        double s = sqrt ((double) a);
        if (RoundingMode == ROUND_N) return (float) s;
        return to32 (s, sgn (fma (-s, s, (double) a)));
}
float t4w_rint32 (float x)
{
        switch (RoundingMode) { case ROUND_Z: return truncf (x); case ROUND_P: return ceilf (x); case ROUND_M: return floorf (x); default: return rintf (x); }
}
float t4w_i32_to_fp32 (int32_t i) { return to32 ((double) i, 0); }
float t4w_fp64_to_fp32 (double d)
{
        if (RoundingMode == ROUND_N) return (float) d;
        return to32 (d, 0);
}
