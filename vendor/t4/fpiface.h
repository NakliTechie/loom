#ifndef _FPIFACE_H
#define _FPIFACE_H

#define T4_NATIVE_FPU

#ifdef T4_NATIVE_FPU
#include <math.h>
#include "redmath.h"

typedef float   REAL32;
typedef double  REAL64;

#ifdef T4WEB
/* Loom: wasm has no rounding-mode control; webfpu.c rounds explicitly. */
double t4w_add64 (double, double); double t4w_sub64 (double, double); double t4w_mul64 (double, double); double t4w_div64 (double, double);
double t4w_sqrt64 (double); double t4w_rint64 (double); double t4w_i32_to_fp64 (int32_t); double t4w_u32_to_fp64 (uint32_t);
float t4w_add32 (float, float); float t4w_sub32 (float, float); float t4w_mul32 (float, float); float t4w_div32 (float, float);
float t4w_sqrt32 (float); float t4w_rint32 (float); float t4w_i32_to_fp32 (int32_t); float t4w_fp64_to_fp32 (double);
#define t4_fpadd64(x, y)       t4w_add64 (x, y)
#define t4_fpsub64(x, y)       t4w_sub64 (x, y)
#define t4_fpmul64(x, y)       t4w_mul64 (x, y)
#define t4_fpdiv64(x, y)       t4w_div64 (x, y)
#else
#define t4_fpadd64(x, y)       ((x) + (y))
#define t4_fpsub64(x, y)       ((x) - (y))
#define t4_fpmul64(x, y)       ((x) * (y))
#define t4_fpdiv64(x, y)       ((x) / (y))
#endif

#define t4_fpremainder64(x, y) fdm_remainder(x, y)
#define t4_fpround64(x)        round(x)
#define t4_fpldexp64(r64, i)   fdm_ldexp(r64, i)
#define t4_fpabs64(x)          fabs(x)
#define t4_fp32_to_fp64(r32)   ((REAL64) (r32))
#define t4_fpremainder32(x, y) remainderf(x, y)
#define t4_fpround32(x)        roundf(x)
#define t4_fpldexp32(r32, i)   fdm_ldexpf(r32, i)
#define t4_fpabs32(x)          fabsf(x)
#ifdef T4WEB
#define t4_fprint64(x)         t4w_rint64(x)
#define t4_fpsqrt64(x)         t4w_sqrt64(x)
#define t4_i32_to_fp64(i32)    t4w_i32_to_fp64(i32)
#define t4_u32_to_fp64(u32)    t4w_u32_to_fp64(u32)
#define t4_fpadd32(x, y)       t4w_add32 (x, y)
#define t4_fpsub32(x, y)       t4w_sub32 (x, y)
#define t4_fpmul32(x, y)       t4w_mul32 (x, y)
#define t4_fpdiv32(x, y)       t4w_div32 (x, y)
#define t4_fprint32(x)         t4w_rint32(x)
#define t4_fpsqrt32(x)         t4w_sqrt32(x)
#define t4_i32_to_fp32(i32)    t4w_i32_to_fp32(i32)
#define t4_fp64_to_fp32(r64)   t4w_fp64_to_fp32(r64)
#else
#define t4_fprint64(x)         rint(x)
#define t4_fpsqrt64(x)         fdm_sqrt(x)
#define t4_i32_to_fp64(i32)    ((REAL64) (i32))
#define t4_u32_to_fp64(u32)    ((REAL64) (u32))
#define t4_fpadd32(x, y)       ((x) + (y))
#define t4_fpsub32(x, y)       ((x) - (y))
#define t4_fpmul32(x, y)       ((x) * (y))
#define t4_fpdiv32(x, y)       ((x) / (y))
#define t4_fprint32(x)         rintf(x)
#define t4_fpsqrt32(x)         sqrtf(x)
#define t4_i32_to_fp32(i32)    ((REAL32) (i32))
#define t4_fp64_to_fp32(r64)   ((REAL32) (r64))
#endif

#else

REAL64 t4_fpadd64 (REAL64, REAL64);
REAL64 t4_fpsub64 (REAL64, REAL64);
REAL64 t4_fpmul64 (REAL64, REAL64);
REAL64 t4_fpdiv64 (REAL64, REAL64);

REAL64 t4_fpremainder64 (REAL64, REAL64);
REAL64 t4_fpround64 (REAL64);
REAL64 t4_fprint64 (REAL64);
REAL64 t4_fpldexp64 (REAL64, int);
REAL64 t4_fpsqrt64 (REAL64);
REAL64 t4_fpabs64 (REAL64);
REAL64 t4_i32_to_fp64 (int32_t);
REAL64 t4_u32_to_fp64 (uint32_t);
REAL64 t4_fp32_to_fp64 (REAL32);


REAL32 t4_fpadd32 (REAL32, REAL32);
REAL32 t4_fpsub32 (REAL32, REAL32);
REAL32 t4_fpmul32 (REAL32, REAL32);
REAL32 t4_fpdiv32 (REAL32, REAL32);

REAL32 t4_fpremainder32 (REAL32, REAL32);
REAL32 t4_fpround32 (REAL32);
REAL32 t4_fprint32 (REAL32);
REAL32 t4_fpldexp32 (REAL32, int);
REAL32 t4_fpsqrt32 (REAL32);
REAL32 t4_fpabs32 (REAL32);
REAL32 t4_i32_to_fp32 (int32_t);
REAL32 t4_fp64_to_fp32 (REAL64);

#endif


#endif
