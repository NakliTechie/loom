# tiny telnet driver: connect to a console port, send lines with delays, dump what comes back
import socket, sys, time, re
port = int(sys.argv[1]); script = sys.argv[2:]   # alternating: text-to-send or "sleep:N"
s = socket.create_connection(("127.0.0.1", port)); s.settimeout(0.3)
out = b""
def drain(t=1.0):
    global out; end = time.time() + t
    while time.time() < end:
        try:
            d = s.recv(4096)
            if not d: break
            out += d
        except socket.timeout: pass
def clean(b):
    b = re.sub(rb"\xff[\xfb-\xfe].", b"", b)  # telnet negotiation
    return re.sub(rb"[^\x20-\x7e\n\r]", b"", b).decode()
drain(2)
for step in script:
    if step.startswith("sleep:"): drain(float(step[6:])); continue
    s.sendall(step.encode() + b"\r\n"); drain(1.5)
drain(1)
print(clean(out))
