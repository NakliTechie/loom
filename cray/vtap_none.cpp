// loom port: no TAP networking on macOS / WebAssembly. Ethernet channels open nothing and receive nothing.
#include "vtap_linux.h"
#include "exceptions.h"
TapAdapter_c::TapAdapter_c() : mDevice(-1), mSignalPipeSend(-1), mSignalPipeRcv(-1) {}
TapAdapter_c::~TapAdapter_c() {}
TapAdapter_c::TapAdapter_c(TapAdapter_c &&aAdapter) : mName(std::move(aAdapter.mName)), mDevice(-1), mSignalPipeSend(-1), mSignalPipeRcv(-1) {}
void TapAdapter_c::Close() {}
void TapAdapter_c::Open() { throw Generic_x() << "TAP networking is not available on this host"; }
std::vector<uint8_t> TapAdapter_c::BlockingReceive() { return std::vector<uint8_t>(); }
void TapAdapter_c::Send(std::vector<uint8_t> aPacket) { (void)aPacket; }
void TapAdapter_c::CancelRead() {}
std::vector<TapAdapter_c> EnumTaps() { return std::vector<TapAdapter_c>(); }
