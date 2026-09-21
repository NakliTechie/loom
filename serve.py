#!/usr/bin/env python3
"""Local preview with the same COOP/COEP headers as site/_headers (SharedArrayBuffer needs them)."""
import http.server, sys, os
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), "site"))
FIXTURES = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "vendor", "t4"))
class H(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        # local-only: /fixtures/... maps to vendor/t4 (toolset tarball, examples) for driving tests; never deployed
        if path.startswith("/fixtures/"):
            return os.path.join(FIXTURES, path[len("/fixtures/"):].split("?")[0])
        return super().translate_path(path)
    def end_headers(self):
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()
H.extensions_map.update({".wasm": "application/wasm", ".js": "text/javascript", ".json": "application/json"})
http.server.ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1]) if len(sys.argv) > 1 else 8767), H).serve_forever()
