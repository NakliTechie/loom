import socket,time,re,sys,json
class Con:
    def __init__(s, port): s.s=socket.create_connection(("127.0.0.1",port)); s.s.settimeout(0.3); s.out=b""
    def drain(s,t):
        end=time.time()+t
        while time.time()<end:
            try:
                d=s.s.recv(4096)
                if not d: break
                s.out+=d
            except socket.timeout: pass
    def send(s,x,t=3): s.s.sendall(x.encode()+b"\r"); s.drain(t)
    def waitfor(s,pat,t=60):
        end=time.time()+t
        while time.time()<end:
            s.drain(1)
            if re.search(pat.encode(), s.out): return True
        return False
    def text(s):
        t=re.sub(rb"\xff[\xfb-\xfe].",b"",s.out); t=re.sub(rb"\x1b\[(\d+);1H",b"\n",t); t=re.sub(rb"\x1b\[\d*C",b" ",t); t=re.sub(rb"\x1b\[[0-9;]*[A-Za-z]",b"",t)
        return re.sub(rb"[^\x20-\x7e\n]",b"",t).decode()
