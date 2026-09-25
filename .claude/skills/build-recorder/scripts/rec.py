#!/usr/bin/env python3
"""
Build recorder: records the real screen while you build with Claude (Claude Design,
claude.ai chat, Claude Code), then edits it into a clean, silent walkthrough ready for
a voiceover: idle time cut, generation fast-forwarded, zoom on every click, section
title cards, and the finished product demo appended.

Standard library only. Needs ffmpeg (brew/winget/apt, or `pip install imageio-ffmpeg`).

  rec.py doctor                      check ffmpeg, screen access, cursor tracking
  rec.py start  [--polish type|paste] start recording (+ live prompt polishing on a hotkey)
  rec.py mark   "text" [--kind K]    add a marker (K = section | step | prompt)
  rec.py status                      is it recording? how long?
  rec.py pause  [--trim 8]           pause (e.g. while writing a rough prompt); cuts the last 8 s
  rec.py resume                      resume recording (parts are joined in the edit)
  rec.py clip   "text" | --file F    copy a polished prompt to the clipboard
  rec.py stop                        stop recording
  rec.py edit   [--demo demo.mp4]    produce final.mp4 + shotlist.md

Everything lives in the session folder (default ./build-recording).
"""
import argparse, ctypes, json, os, platform, re, shutil, signal, subprocess, sys, time

SYSTEM = platform.system()  # Darwin | Windows | Linux
DEFAULT_DIR = os.path.abspath(os.environ.get("BUILD_REC_DIR", "build-recording"))
FPS = 30


# ---------------------------------------------------------------- helpers
def die(msg, code=1):
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(code)


def ffmpeg_path():
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    try:
        import imageio_ffmpeg  # pip install imageio-ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return None


def need_ffmpeg():
    exe = ffmpeg_path()
    if not exe:
        hint = {"Darwin": "brew install ffmpeg", "Windows": "winget install Gyan.FFmpeg"}.get(SYSTEM, "sudo apt install ffmpeg")
        die(f"ffmpeg not found. Install it with `{hint}` (or `pip install imageio-ffmpeg`).")
    return exe


def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


def state_path(d):
    return os.path.join(d, "state.json")


def load_state(d):
    try:
        with open(state_path(d)) as f:
            return json.load(f)
    except FileNotFoundError:
        return None


def save_state(d, st):
    with open(state_path(d), "w") as f:
        json.dump(st, f, indent=2)


def alive(pid):
    if not pid:
        return False
    if SYSTEM == "Windows":
        out = run(["tasklist", "/FI", f"PID eq {pid}", "/NH"]).stdout
        return str(pid) in out
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def is_cloud():
    if os.environ.get("BUILD_REC_FORCE") == "1":  # testing on a virtual display (Xvfb)
        return False
    return os.environ.get("CLAUDE_CODE_REMOTE") == "true" or os.environ.get("CLAUDE_CODE_ENTRYPOINT") == "remote"


def spawn_detached(cmd, log):
    kw = dict(stdin=subprocess.DEVNULL, stdout=log, stderr=log)
    if SYSTEM == "Windows":
        kw["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP | getattr(subprocess, "CREATE_NO_WINDOW", 0)
    else:
        kw["start_new_session"] = True
    return subprocess.Popen(cmd, **kw)


# ---------------------------------------------------------------- cursor / input sampling
class Input:
    """Cursor position, left-button state and 'a key is down' per platform."""

    def __init__(self):
        self.ok = False
        self.size = None  # screen size in the same units as the cursor coordinates
        try:
            getattr(self, "_init_" + SYSTEM.lower())()
            self.ok = True
        except Exception as e:  # pragma: no cover - platform specific
            self.err = str(e)

    # macOS: CoreGraphics via ctypes (no pyobjc needed)
    def _init_darwin(self):
        cg = ctypes.cdll.LoadLibrary("/System/Library/Frameworks/ApplicationServices.framework/ApplicationServices")
        cf = ctypes.cdll.LoadLibrary("/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation")

        class P(ctypes.Structure):
            _fields_ = [("x", ctypes.c_double), ("y", ctypes.c_double)]

        class R(ctypes.Structure):
            _fields_ = [("origin", P), ("size", P)]

        cg.CGEventCreate.restype = ctypes.c_void_p
        cg.CGEventCreate.argtypes = [ctypes.c_void_p]
        cg.CGEventGetLocation.restype = P
        cg.CGEventGetLocation.argtypes = [ctypes.c_void_p]
        cg.CGEventSourceButtonState.restype = ctypes.c_bool
        cg.CGEventSourceButtonState.argtypes = [ctypes.c_int32, ctypes.c_uint32]
        cg.CGEventSourceSecondsSinceLastEventType.restype = ctypes.c_double
        cg.CGEventSourceSecondsSinceLastEventType.argtypes = [ctypes.c_int32, ctypes.c_uint32]
        cg.CGMainDisplayID.restype = ctypes.c_uint32
        cg.CGDisplayBounds.restype = R
        cg.CGDisplayBounds.argtypes = [ctypes.c_uint32]
        cf.CFRelease.argtypes = [ctypes.c_void_p]
        b = cg.CGDisplayBounds(cg.CGMainDisplayID())
        self.size = (b.size.x, b.size.y)  # points; the video is in pixels (Retina = 2x)

        def sample():
            ev = cg.CGEventCreate(None)
            p = cg.CGEventGetLocation(ev)
            cf.CFRelease(ev)
            down = cg.CGEventSourceButtonState(1, 0)  # HID state, left button
            key_age = cg.CGEventSourceSecondsSinceLastEventType(1, 10)  # kCGEventKeyDown
            return p.x, p.y, down, key_age < 0.12

        self.sample = sample

    # Windows: user32 via ctypes
    def _init_windows(self):
        u = ctypes.windll.user32
        try:
            ctypes.windll.shcore.SetProcessDpiAwareness(2)
        except Exception:
            u.SetProcessDPIAware()

        class PT(ctypes.Structure):
            _fields_ = [("x", ctypes.c_long), ("y", ctypes.c_long)]

        self.size = (u.GetSystemMetrics(0), u.GetSystemMetrics(1))
        keys = list(range(0x08, 0x5B)) + list(range(0x60, 0x70)) + list(range(0xBA, 0xDF))
        pt = PT()

        def sample():
            u.GetCursorPos(ctypes.byref(pt))
            down = bool(u.GetAsyncKeyState(0x01) & 0x8000)
            key = any(u.GetAsyncKeyState(k) & 0x8000 for k in keys)
            return pt.x, pt.y, down, key

        self.sample = sample

    # Linux/X11: xdotool (optional)
    def _init_linux(self):
        if not shutil.which("xdotool") or not os.environ.get("DISPLAY"):
            raise RuntimeError("xdotool or DISPLAY missing")
        g = run(["xdotool", "getdisplaygeometry"]).stdout.split()
        self.size = (int(g[0]), int(g[1]))

        def sample():
            out = run(["xdotool", "getmouselocation", "--shell"]).stdout
            v = dict(l.split("=") for l in out.split() if "=" in l)
            # Button state isn't exposed by xdotool; clicks are read from `xinput` if present.
            return int(v["X"]), int(v["Y"]), False, False

        self.sample = sample


def logger_loop(d):
    """Background process: sample cursor/button/keys ~30x a second into input.jsonl."""
    inp = Input()
    st = load_state(d) or {}
    meta = {"ok": inp.ok, "size": inp.size, "err": getattr(inp, "err", None)}
    with open(os.path.join(d, "input_meta.json"), "w") as f:
        json.dump(meta, f)
    if not inp.ok:
        return
    stop_file = os.path.join(d, "STOP")
    xinput = None
    if SYSTEM == "Linux" and shutil.which("xinput"):
        # `xinput test-xi2 --root` streams raw button events; used only for click times.
        xinput = subprocess.Popen(["xinput", "test-xi2", "--root"], stdout=subprocess.PIPE, text=True, bufsize=1)
        os.set_blocking(xinput.stdout.fileno(), False)
    last = None
    with open(os.path.join(d, "input.jsonl"), "a") as f:
        while not os.path.exists(stop_file):
            t = time.time()
            try:
                x, y, down, key = inp.sample()
            except Exception:
                time.sleep(0.1)
                continue
            if xinput:
                try:
                    chunk = xinput.stdout.read() or ""
                    if "RawButtonPress" in chunk:
                        down = True
                    if "RawKeyPress" in chunk:
                        key = True
                except Exception:
                    pass
            cur = (round(x), round(y), bool(down), bool(key))
            if cur != last:
                f.write(json.dumps({"t": round(t, 3), "x": cur[0], "y": cur[1], "b": cur[2], "k": cur[3]}) + "\n")
                f.flush()
                last = cur
            time.sleep(max(0.0, 1 / 30 - (time.time() - t)))
    if xinput:
        xinput.terminate()


# ---------------------------------------------------------------- capture
def capture_cmd(ff, out):
    enc = ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "24", "-pix_fmt", "yuv420p", "-g", str(FPS * 2)]
    if SYSTEM == "Darwin":
        listing = run([ff, "-f", "avfoundation", "-list_devices", "true", "-i", ""]).stderr
        m = re.search(r"\[(\d+)\] Capture screen 0", listing)
        if not m:
            die("No screen found to capture. Give your terminal / Claude app Screen Recording permission:\n"
                "System Settings → Privacy & Security → Screen & System Audio Recording, then restart it.")
        src = ["-f", "avfoundation", "-capture_cursor", "1", "-capture_mouse_clicks", "1", "-framerate", str(FPS), "-i", f"{m.group(1)}:none"]
    elif SYSTEM == "Windows":
        src = ["-f", "gdigrab", "-framerate", str(FPS), "-draw_mouse", "1", "-i", "desktop"]
    else:
        disp = os.environ.get("DISPLAY")
        if not disp:
            die("No display to record (DISPLAY is not set).")
        src = ["-f", "x11grab", "-draw_mouse", "1", "-framerate", str(FPS), "-i", disp]
    return [ff, "-hide_banner", "-loglevel", "warning", "-y", *src, *enc, out]


def cmd_doctor(a):
    ok = True
    print(f"OS: {SYSTEM} {platform.release()}")
    if is_cloud():
        print("✗ This is a cloud session: it cannot see your screen. Run Claude Code on your own computer (desktop app or CLI).")
        ok = False
    ff = ffmpeg_path()
    print(("✓ ffmpeg: " + ff) if ff else "✗ ffmpeg not found")
    ok &= bool(ff)
    inp = Input()
    print(("✓ cursor tracking: screen " + "x".join(str(round(v)) for v in inp.size)) if inp.ok else f"~ cursor tracking unavailable ({getattr(inp, 'err', '')}); zooms will be skipped")
    if ff and SYSTEM == "Darwin":
        listing = run([ff, "-f", "avfoundation", "-list_devices", "true", "-i", ""]).stderr
        has = "Capture screen" in listing
        print("✓ screen capture device found" if has else "✗ no screen capture device: grant Screen Recording permission to your terminal/Claude app")
        ok &= has
    try:
        import pynput  # noqa: F401
        has_pynput = True
    except Exception:
        has_pynput = False
    print("✓ live polish: pynput installed" if has_pynput else "~ live polish unavailable: pip install pynput")
    print(("✓ live polish: Claude Code CLI " + shutil.which("claude")) if shutil.which("claude") or os.environ.get("BUILD_REC_POLISH_CMD")
          else "~ live polish needs the `claude` CLI on PATH")
    if SYSTEM == "Darwin":
        print("  macOS: live polish also needs Accessibility + Input Monitoring for this app (Privacy & Security)")
    print("READY" if ok else "NOT READY")
    sys.exit(0 if ok else 1)


def cmd_start(a):
    if is_cloud():
        die("This is a cloud session, so there is no screen here to record. Start a Claude Code session on your own computer "
            "(desktop app or `claude` in a terminal) and invoke the skill there.")
    d = a.dir
    os.makedirs(d, exist_ok=True)
    st = load_state(d)
    if st and alive(st.get("ffmpeg_pid")):
        die(f"Already recording since {time.ctime(st['start'])}. Use `rec.py stop` first.")
    ff = need_ffmpeg()
    n = len([p for p in os.listdir(d) if re.match(r"screen-\d+\.mkv$", p)])
    video = os.path.join(d, f"screen-{n + 1:02d}.mkv")
    for p in ("STOP",):
        try:
            os.remove(os.path.join(d, p))
        except FileNotFoundError:
            pass
    log = open(os.path.join(d, "ffmpeg.log"), "a")
    t0 = time.time()
    proc = spawn_detached(capture_cmd(ff, video), log)
    lg = spawn_detached([sys.executable, os.path.abspath(__file__), "_logger", "--dir", d], open(os.path.join(d, "logger.log"), "a"))
    parts = (st or {}).get("parts", [])
    parts.append({"video": video, "start": t0})
    polish = getattr(a, "polish", None) or (st or {}).get("polish")
    pol_pid = None
    if polish:
        pol = spawn_detached([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), "polish.py"),
                              "--dir", d, "--mode", polish], open(os.path.join(d, "polish.log"), "a"))
        pol_pid = pol.pid
    st = {"start": (st or {}).get("start", t0), "ffmpeg_pid": proc.pid, "logger_pid": lg.pid, "polish_pid": pol_pid,
          "polish": polish, "parts": parts, "system": SYSTEM}
    save_state(d, st)
    time.sleep(3)
    if not alive(proc.pid) or not os.path.exists(video):
        tail = open(os.path.join(d, "ffmpeg.log")).read()[-1500:]
        die("Screen capture did not start.\n" + tail +
            ("\nOn macOS: allow Screen Recording for your terminal/Claude app in System Settings → Privacy & Security, then retry."
             if SYSTEM == "Darwin" else ""))
    print(f"RECORDING → {video}")
    if polish:
        time.sleep(1)
        if not alive(pol_pid):
            print("WARNING: live polisher did not start; see polish.log (pip install pynput; macOS needs "
                  "Accessibility + Input Monitoring permission).")
        else:
            hk = "Cmd+Option+P" if SYSTEM == "Darwin" else "Ctrl+Alt+P"
            print(f"LIVE POLISH ON ({polish} mode): type a rough prompt, press {hk}.")
    print("Tip: turn on Do Not Disturb; the whole screen is recorded.")


def cmd_mark(a):
    d = a.dir
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, "markers.jsonl"), "a") as f:
        f.write(json.dumps({"t": round(time.time(), 3), "kind": a.kind, "text": a.text}) + "\n")
    print(f"marked [{a.kind}] {a.text}")


def cmd_status(a):
    st = load_state(a.dir)
    if not st:
        print("not recording (no session)")
        return
    rec = alive(st.get("ffmpeg_pid"))
    print(("RECORDING" if rec else "stopped") + f", session started {time.ctime(st['start'])}, {len(st['parts'])} part(s)")


def cmd_stop(a):
    d = a.dir
    st = load_state(d)
    if not st:
        die("No recording session in " + d)
    open(os.path.join(d, "STOP"), "w").close()
    pid = st.get("ffmpeg_pid")
    if alive(pid):
        if SYSTEM == "Windows":
            try:
                os.kill(pid, signal.CTRL_BREAK_EVENT)
            except Exception:
                pass
        else:
            os.kill(pid, signal.SIGINT)
        for _ in range(100):
            if not alive(pid):
                break
            time.sleep(0.1)
        if alive(pid):
            if SYSTEM == "Windows":
                run(["taskkill", "/F", "/PID", str(pid)])
            else:
                os.kill(pid, signal.SIGKILL)
    st["parts"][-1]["end"] = time.time()
    st["ffmpeg_pid"] = None
    if getattr(a, "trim", 0):
        # The last few seconds before a pause show the user asking to pause: cut them.
        st["parts"][-1]["trim_end"] = a.trim
    save_state(d, st)
    dur = st["parts"][-1]["end"] - st["parts"][-1]["start"]
    word = "PAUSED" if getattr(a, "trim", 0) else "STOPPED"
    print(f"{word}. Part {len(st['parts'])}: {dur / 60:.1f} min → {st['parts'][-1]['video']}")


def cmd_pause(a):
    """Pause for private work (e.g. writing a rough prompt). Nothing is recorded until resume."""
    st = load_state(a.dir)
    if not st or not alive(st.get("ffmpeg_pid")):
        die("Not recording.")
    cmd_stop(a)


def cmd_resume(a):
    cmd_start(a)


def cmd_clip(a):
    """Copy text (or a file's contents) to the clipboard, ready to paste into Claude Design/Code."""
    text = open(a.file, encoding="utf-8").read() if a.file else a.text
    if text is None:
        die("Give text or --file.")
    if SYSTEM == "Darwin":
        cmd = ["pbcopy"]
    elif SYSTEM == "Windows":
        # clip.exe mangles non-ASCII; PowerShell's Set-Clipboard reads UTF-8 from stdin correctly.
        cmd = ["powershell", "-NoProfile", "-Command", "$input | Out-String | Set-Clipboard"]
    else:
        cmd = ["wl-copy"] if shutil.which("wl-copy") else ["xclip", "-selection", "clipboard"]
    try:
        # xclip keeps running to serve the clipboard: detach its output so callers don't wait on it.
        subprocess.run(cmd, input=text.rstrip("\n"), text=True, check=True, encoding="utf-8",
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception as e:
        die(f"Could not copy to the clipboard ({e}).")
    print(f"COPIED {len(text)} characters to the clipboard.")


# ---------------------------------------------------------------- editing
def probe(ff, path):
    err = run([ff, "-hide_banner", "-i", path]).stderr
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", err)
    dur = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3)) if m else 0
    m2 = re.search(r"Video:.*?(\d{2,5})x(\d{2,5})", err)
    return dur, int(m2.group(1)), int(m2.group(2))


def mkv_duration(ff, path):
    # mkv written by an interrupted ffmpeg may lack a duration header: count by decoding.
    dur, w, h = probe(ff, path)
    if dur <= 0:
        err = run([ff, "-hide_banner", "-i", path, "-f", "null", "-"]).stderr
        ts = re.findall(r"time=(\d+):(\d+):([\d.]+)", err)
        if ts:
            hh, mm, ss = ts[-1]
            dur = int(hh) * 3600 + int(mm) * 60 + float(ss)
    return dur, w, h


def freeze_intervals(ff, path, min_d=1.2):
    """Periods where the screen is visually static (nothing changing)."""
    err = run([ff, "-hide_banner", "-i", path, "-vf", f"fps=10,scale=480:-2,freezedetect=n=-48dB:d={min_d}", "-an", "-f", "null", "-"]).stderr
    starts = [float(x) for x in re.findall(r"freeze_start: ([\d.]+)", err)]
    ends = [float(x) for x in re.findall(r"freeze_end: ([\d.]+)", err)]
    out = []
    for i, s in enumerate(starts):
        out.append((s, ends[i] if i < len(ends) else float("inf")))
    return out


def load_jsonl(p):
    try:
        with open(p) as f:
            return [json.loads(l) for l in f if l.strip()]
    except FileNotFoundError:
        return []


def classify(dur, frozen, events, clicks, args):
    """Split a recording into segments: cut (idle), fast (generating), type, normal."""
    step = 0.25
    n = int(dur / step) + 1
    static = [False] * n
    for s, e in frozen:
        for i in range(int(s / step), min(n, int(min(e, dur) / step) + 1)):
            static[i] = True
    mouse = [False] * n
    typing = [False] * n
    for ev in events:
        i = int(ev["t"] / step)
        if 0 <= i < n:
            if ev.get("k"):
                for j in range(max(0, i - 2), min(n, i + 5)):
                    typing[j] = True
            else:
                for j in range(max(0, i - 2), min(n, i + 3)):
                    mouse[j] = True
    for c in clicks:
        i = int(c["t"] / step)
        for j in range(max(0, i - 4), min(n, i + 8)):
            mouse[j] = True
    labels = []
    for i in range(n):
        if mouse[i]:
            labels.append("normal")
        elif typing[i]:
            labels.append("type")
        elif static[i]:
            labels.append("idle")
        else:
            labels.append("fast")
    # Run-length encode.
    segs = []
    for i, lab in enumerate(labels):
        t = i * step
        if segs and segs[-1][2] == lab:
            segs[-1][1] = min(dur, t + step)
        else:
            segs.append([t, min(dur, t + step), lab])
    # Short "fast" or "idle" blips between interactions stay at normal speed.
    for s in segs:
        if s[2] in ("fast", "idle") and s[1] - s[0] < args.min_gap:
            s[2] = "normal"
    merged = []
    for s in segs:
        if merged and merged[-1][2] == s[2]:
            merged[-1][1] = s[1]
        else:
            merged.append(list(s))
    return merged


def subtract(segs, cuts):
    """Remove cut intervals from classified segments."""
    out = []
    for s, e, kind in segs:
        pieces = [(s, e)]
        for cs, ce in cuts:
            nxt = []
            for a0, a1 in pieces:
                if ce <= a0 or cs >= a1:
                    nxt.append((a0, a1))
                else:
                    if cs > a0:
                        nxt.append((a0, cs))
                    if ce < a1:
                        nxt.append((ce, a1))
            pieces = nxt
        out += [[a0, a1, kind] for a0, a1 in pieces if a1 - a0 > 0.2]
    return out


def zoom_windows(clicks, t0, t1, W, H, sx, sy, zoom):
    """Click zoom windows inside [t0, t1] as (start, end, cx, cy) in video pixels."""
    out = []
    for c in clicks:
        if t0 <= c["t"] < t1:
            s, e = max(t0, c["t"] - 0.8), min(t1, c["t"] + 1.6)
            cx, cy = c["x"] * sx, c["y"] * sy
            if out and s <= out[-1][1] + 0.4:
                # Chain nearby clicks into one window; the camera pans to the latest click.
                out[-1] = (out[-1][0], e, cx, cy)
            else:
                out.append((s, e, cx, cy))
    return [w for w in out if w[1] - w[0] > 0.5]


def has_drawtext(ff):
    return " drawtext " in run([ff, "-hide_banner", "-filters"]).stdout


def text_card(ff, text, sub, W, H, out, secs, font):
    """A title card: rendered by Playwright (card.mjs) when available, else ffmpeg drawtext, else blank."""
    png = out + ".png"
    node = shutil.which("node")
    if node:
        r = run([node, os.path.join(os.path.dirname(os.path.abspath(__file__)), "card.mjs"), png, str(W), str(H), text, sub or ""])
        if r.returncode == 0 and os.path.exists(png):
            subprocess.run([ff, "-hide_banner", "-loglevel", "error", "-y", "-loop", "1", "-framerate", str(FPS), "-t", str(secs), "-i", png,
                            "-vf", "format=yuv420p", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-r", str(FPS), out], check=True)
            return
    cmd = [ff, "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", f"color=c=0x0b0b0e:s={W}x{H}:d={secs}:r={FPS}"]
    vf = []
    if font and has_drawtext(ff):
        tf = out + ".txt"
        with open(tf, "w", encoding="utf-8") as f:
            f.write(text)
        vf.append(f"drawtext=fontfile='{font}':textfile='{tf}':fontcolor=0xf2efe9:fontsize={int(H * 0.075)}:x=(w-text_w)/2:y=(h-text_h)/2-{int(H * 0.03)}")
        if sub:
            sf = out + ".sub.txt"
            with open(sf, "w", encoding="utf-8") as f:
                f.write(sub)
            vf.append(f"drawtext=fontfile='{font}':textfile='{sf}':fontcolor=0xff7a45:fontsize={int(H * 0.028)}:x=(w-text_w)/2:y=(h/2)+{int(H * 0.06)}")
    vf.append("format=yuv420p")
    cmd += ["-vf", ",".join(vf), "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-r", str(FPS), out]
    subprocess.run(cmd, check=True)


def find_font():
    for p in ("/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/System/Library/Fonts/Helvetica.ttc",
              "/Library/Fonts/Arial.ttf", "C:/Windows/Fonts/segoeuib.ttf", "C:/Windows/Fonts/arialbd.ttf",
              "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf"):
        if os.path.exists(p):
            return p.replace("\\", "/").replace(":", "\\:") if SYSTEM == "Windows" else p
    return None


def render_segment(ff, src, s, e, kind, speed, zooms, W, H, OW, OH, out, zoom):
    """Encode one segment at output size; fast segments are sped up, click windows zoomed."""
    dur = e - s
    base = [ff, "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{s:.3f}", "-t", f"{dur:.3f}", "-i", src]
    vf = [f"fps={FPS}"]
    if zooms:
        # Zoom in on each click window with an eased in/out, panning to the click.
        z_parts, x_parts, y_parts = [], [], []
        for (zs, ze, cx, cy) in zooms:
            a, b = zs - s, ze - s
            ease = f"(if(lt(T,{a + 0.4:.3f}),(T-{a:.3f})/0.4,if(gt(T,{b - 0.4:.3f}),({b:.3f}-T)/0.4,1)))"
            inside = f"between(T,{a:.3f},{b:.3f})"
            z_parts.append(f"{inside}*{zoom - 1:.3f}*{ease}")
            x_parts.append(f"{inside}*{cx:.1f}")
            y_parts.append(f"{inside}*{cy:.1f}")
        T = f"(on/{FPS})"
        z = "1+" + "+".join(z_parts)
        z = z.replace("T", T)
        cx = "+".join(x_parts).replace("T", T) or str(W / 2)
        cy = "+".join(y_parts).replace("T", T) or str(H / 2)
        vf.append(
            f"zoompan=z='{z}':x='max(0,min(iw-iw/zoom,({cx})-iw/zoom/2))':"
            f"y='max(0,min(ih-ih/zoom,({cy})-ih/zoom/2))':d=1:s={W}x{H}:fps={FPS}"
        )
    if kind in ("fast", "type") and speed != 1:
        # Speed up after zooming (zoompan re-times frames), then drop to the output rate.
        vf += [f"setpts=PTS/{speed:.3f}", f"fps={FPS}"]
    vf += [f"scale={OW}:{OH}:force_original_aspect_ratio=decrease:flags=lanczos",
           f"pad={OW}:{OH}:(ow-iw)/2:(oh-ih)/2:color=0x0b0b0e", "format=yuv420p"]
    cmd = base + ["-vf", ",".join(vf), "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-r", str(FPS), out]
    subprocess.run(cmd, check=True)


def fmt(t):
    return f"{int(t // 60):02d}:{t % 60:04.1f}"


def cmd_edit(a):
    d = a.dir
    ff = need_ffmpeg()
    st = load_state(d)
    if not st:
        die("No recording session in " + d)
    if alive(st.get("ffmpeg_pid")):
        die("Still recording. Run `rec.py stop` first.")
    markers = load_jsonl(os.path.join(d, "markers.jsonl"))
    polishes = load_jsonl(os.path.join(d, "polish.jsonl"))
    events = load_jsonl(os.path.join(d, "input.jsonl"))
    meta = {}
    try:
        meta = json.load(open(os.path.join(d, "input_meta.json")))
    except Exception:
        pass
    work = os.path.join(d, "work")
    shutil.rmtree(work, ignore_errors=True)
    os.makedirs(work)
    OW, OH = a.width, a.height
    font = find_font()
    pieces, shots = [], []
    out_t = 0.0

    def add(path, secs, desc, kind):
        nonlocal out_t
        pieces.append(path)
        shots.append((out_t, secs, kind, desc))
        out_t += secs

    k = 0
    if a.title:
        p = os.path.join(work, f"{k:04d}.mp4"); k += 1
        text_card(ff, a.title, a.subtitle or "", OW, OH, p, 3, font)
        add(p, 3, a.title, "title")

    sections_done = set()
    for pi, part in enumerate(st["parts"]):
        src = part["video"]
        if not os.path.exists(src):
            continue
        dur, W, H = mkv_duration(ff, src)
        dur = max(0.0, dur - part.get("trim_end", 0))
        if dur < 1:
            continue
        p0 = part["start"] + a.offset
        p1 = part.get("end", p0 + dur)
        ev = [dict(e, t=e["t"] - p0) for e in events if p0 - 1 <= e["t"] <= p1 + 1]
        # A click = button goes from up to down.
        clicks, prev = [], False
        for e in ev:
            if e.get("b") and not prev:
                clicks.append(e)
            prev = bool(e.get("b"))
        size = meta.get("size") or [W, H]
        sx, sy = W / size[0], H / size[1]
        mk = sorted([dict(m, t=m["t"] - p0) for m in markers if p0 - 2 <= m["t"] <= p1 + 2], key=lambda m: m["t"])
        segs = classify(dur, freeze_intervals(ff, src), ev, clicks, a)
        # Live polish: cut from where the rough prompt was started until the polished one appears.
        cuts = [(p["t_rough"] - p0 - 0.3, p["t_out_start"] - p0) for p in polishes
                if "t_out_start" in p and p0 - 5 <= p["t_hotkey"] <= p1 + 1]
        segs = subtract(segs, cuts)
        for p in polishes:
            if "t_out_start" in p and p0 - 5 <= p["t_hotkey"] <= p1 + 1:
                mk.append({"t": p["t_out_start"] - p0 + 0.01, "kind": "prompt", "text": p["polished"].splitlines()[0][:90]})
        mk.sort(key=lambda m: m["t"])
        # Section cards are inserted where section markers fall.
        sec_marks = [m for m in mk if m["kind"] == "section"]
        for s, e, kind in segs:
            for m in sec_marks:
                key = (pi, m["t"], m["text"])
                if key not in sections_done and m["t"] < e:
                    sections_done.add(key)
                    p = os.path.join(work, f"{k:04d}.mp4"); k += 1
                    text_card(ff, m["text"], "", OW, OH, p, 2, font)
                    add(p, 2, m["text"], "section")
            if kind == "idle":
                keep = min(e - s, a.idle_keep)
                if keep < 0.3:
                    continue
                s2, e2, kind2, speed = s, s + keep, "normal", 1
            elif kind == "fast":
                speed = max(a.speed, (e - s) / a.max_fast)
                s2, e2, kind2 = s, e, "fast"
            elif kind == "type":
                speed = a.type_speed
                s2, e2, kind2 = s, e, "type"
            else:
                s2, e2, kind2, speed = s, e, "normal", 1
            zooms = [] if kind2 == "fast" or a.no_zoom else zoom_windows(clicks, s2, e2, W, H, sx, sy, a.zoom)
            p = os.path.join(work, f"{k:04d}.mp4"); k += 1
            render_segment(ff, src, s2, e2, kind2, speed, zooms, W, H, OW, OH, p, a.zoom)
            secs = (e2 - s2) / speed
            notes = [m["text"] for m in mk if s2 <= m["t"] < e2 and m["kind"] != "section"]
            desc = {"fast": f"Fast-forward {speed:.0f}x (Claude generating / waiting)", "type": "Typing a prompt",
                    "normal": "On-screen interaction" + (" with zoom on clicks" if zooms else "")}[kind2]
            add(p, secs, desc + ("  ·  " + " / ".join(notes) if notes else ""), kind2)

    if a.demo:
        if a.demo_title:
            p = os.path.join(work, f"{k:04d}.mp4"); k += 1
            text_card(ff, a.demo_title, "", OW, OH, p, 2, font)
            add(p, 2, a.demo_title, "section")
        ddur, DW, DH = probe(ff, a.demo)
        dclicks = json.load(open(a.demo_clicks)) if a.demo_clicks and os.path.exists(a.demo_clicks) else []
        labels = []
        if a.demo_labels and os.path.exists(a.demo_labels):
            labels = json.load(open(a.demo_labels))
        zooms = [] if a.no_zoom else zoom_windows(dclicks, 0, ddur, DW, DH, 1, 1, a.demo_zoom)
        p = os.path.join(work, f"{k:04d}.mp4"); k += 1
        render_segment(ff, a.demo, 0, ddur, "normal", 1, zooms, DW, DH, OW, OH, p, a.demo_zoom)
        base = out_t
        add(p, ddur, "Product demo", "demo")
        for lab in labels:
            shots.append((base + lab["t"], 0, "demo-step", lab["text"]))

    if not pieces:
        die("Nothing to edit: no recording found.")
    lst = os.path.join(work, "list.txt")
    with open(lst, "w") as f:
        for p in pieces:
            f.write(f"file '{os.path.abspath(p)}'\n")
    final = os.path.abspath(a.out or os.path.join(d, "final.mp4"))
    subprocess.run([ff, "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", "-movflags", "+faststart", final], check=True)

    # Shot list for the voiceover.
    md = [f"# Shot list: {os.path.basename(final)}", "", f"Total length: {fmt(out_t)}", "",
          "| Time | Length | What's on screen | Voiceover notes |", "|---|---|---|---|"]
    merged = []
    for t, secs, kind, desc in sorted(shots, key=lambda s: s[0]):
        if merged and merged[-1][2] == kind == "normal" and not desc.count("·") and not merged[-1][3].count("·"):
            merged[-1] = (merged[-1][0], merged[-1][1] + secs, kind, merged[-1][3])
        else:
            merged.append((t, secs, kind, desc))
    for t, secs, kind, desc in merged:
        if kind == "demo-step":
            md.append(f"| {fmt(t)} | · | Demo step: {desc} |  |")
        else:
            md.append(f"| {fmt(t)} | {secs:.1f}s | {desc} |  |")
    md += ["", "## Prompts and steps marked during the session", ""]
    for m in markers:
        md.append(f"- **{m['kind']}** · {m['text']}")
    with open(os.path.join(d, "shotlist.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(md) + "\n")
    print(f"FINAL → {final}  ({fmt(out_t)})")
    print(f"SHOT LIST → {os.path.join(d, 'shotlist.md')}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    def with_dir(p):
        p.add_argument("--dir", default=DEFAULT_DIR, type=os.path.abspath)
        return p

    with_dir(sub.add_parser("doctor"))
    sp = with_dir(sub.add_parser("start"))
    sp.add_argument("--polish", choices=["type", "paste"], help="live prompt polishing: hotkey rewrites the prompt in place")
    with_dir(sub.add_parser("status"))
    with_dir(sub.add_parser("stop"))
    pz = with_dir(sub.add_parser("pause"))
    pz.add_argument("--trim", type=float, default=8.0, help="seconds cut from just before the pause")
    rs = with_dir(sub.add_parser("resume"))
    rs.add_argument("--polish", choices=["type", "paste"])
    cl = with_dir(sub.add_parser("clip"))
    cl.add_argument("text", nargs="?")
    cl.add_argument("--file")
    m = with_dir(sub.add_parser("mark"))
    m.add_argument("text")
    m.add_argument("--kind", default="step", choices=["section", "step", "prompt"])
    e = with_dir(sub.add_parser("edit"))
    e.add_argument("--out")
    e.add_argument("--title", help="opening title card text")
    e.add_argument("--subtitle")
    e.add_argument("--demo", help="product demo video to append (from demo.mjs)")
    e.add_argument("--demo-clicks", help="clicks JSON written by demo.mjs")
    e.add_argument("--demo-labels", help="step labels JSON written by demo.mjs")
    e.add_argument("--demo-title", default="The finished product")
    e.add_argument("--speed", type=float, default=6, help="fast-forward factor while Claude generates")
    e.add_argument("--max-fast", type=float, default=8, help="longest a fast-forward may last on screen, seconds")
    e.add_argument("--type-speed", type=float, default=1.5)
    e.add_argument("--idle-keep", type=float, default=0.6, help="seconds kept from each idle stretch")
    e.add_argument("--min-gap", type=float, default=1.5, help="shorter pauses stay at normal speed")
    e.add_argument("--zoom", type=float, default=1.8)
    e.add_argument("--demo-zoom", type=float, default=1.35)
    e.add_argument("--no-zoom", action="store_true")
    e.add_argument("--offset", type=float, default=0.0, help="seconds between recorder start and first video frame")
    e.add_argument("--width", type=int, default=1920)
    e.add_argument("--height", type=int, default=1080)
    lg = with_dir(sub.add_parser("_logger"))
    a = ap.parse_args()
    if a.cmd == "_logger":
        return logger_loop(a.dir)
    {"doctor": cmd_doctor, "start": cmd_start, "status": cmd_status, "stop": cmd_stop, "mark": cmd_mark, "edit": cmd_edit,
     "pause": cmd_pause, "resume": cmd_resume, "clip": cmd_clip}[a.cmd](a)


if __name__ == "__main__":
    main()
