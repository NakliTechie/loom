#!/bin/sh
# Build one emulated transputer as WASM for a Worker. Output: site/t4.js + site/t4.wasm
set -e
ENV=worker; OUT=../../site/t4.js
if [ "$1" = "--node" ]; then ENV=node; EXTRA="-lnodefs.js"; mkdir -p "$(dirname "$0")/build"; OUT=../../build/t4-node.js; fi
cd "$(dirname "$0")/vendor/t4"
SRC="k_standard.c s_scalbn.c s_scalbnf.c s_ldexp.c s_ldexpf.c e_fmod.c e_remainder.c e_sqrt.c w_remainder.c w_sqrt.c \
     arithmetic.c fparithmetic.c netcfg.c shlink.c server.c p.c main.c webterm.c web.c"
emcc -O2 -I. -Wno-unused -Wno-format \
  -DCURTERM=1 -DT4COMBINATIONS=1 -DT4RELEASE=1 -DT4WEB=1 -DT4WEB_INSTR_PER_USEC=10 \
  -ffloat-store -frounding-math \
  $SRC -lm \
  -sMODULARIZE=1 -sEXPORT_NAME=createT4 -sENVIRONMENT=$ENV \
  -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=16MB -sEXIT_RUNTIME=0 -sINVOKE_RUN=0 \
  -sFORCE_FILESYSTEM=1 \
  -sEXPORTED_FUNCTIONS=_main,_t4_run,_t4_instr,_t4_halted,_t4_finish \
  -sEXPORTED_RUNTIME_METHODS=callMain,FS,ENV,cwrap,ccall,stringToUTF8,UTF8ToString \
  $EXTRA -o $OUT
ls -la $OUT
