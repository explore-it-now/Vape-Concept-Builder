#!/usr/bin/env python3
"""
Live prompt polisher. Runs in the background while recording.

Type a rough prompt into any prompt box (Claude Design, claude.ai, the Claude Code desktop app),
press the hotkey, and it is rewritten into a polished prompt in place: typed out letter by letter
(default) or pasted. Each polish is logged so the editor cuts the rough typing from the video.

  polish.py --dir build-recording [--mode type|paste] [--hotkey "<ctrl>+<alt>+p"] [--cps 38]

Needs: pip install pynput. The rewrite uses the Claude Code CLI (`claude -p`), so no API key is
needed; set BUILD_REC_POLISH_CMD to use another command (it reads the request on stdin).
macOS: allow Accessibility and Input Monitoring for the app running this (System Settings →
Privacy & Security), or the hotkey and typing won't work.
"""
import argparse, json, os, platform, random, shlex, shutil, subprocess, sys, threading, time

SYSTEM = platform.system()
HERE = os.path.dirname(os.path.abspath(__file__))

keyboard = Controller = Key = MOD = None


def load_pynput():
    """Imported lazily: pynput needs a display/permissions, the --test path doesn't."""
    global keyboard, Controller, Key, MOD
    try:
        from pynput import keyboard as kbmod
        from pynput.keyboard import Controller as C, Key as K
    except ImportError as e:
        msg = "pip install pynput" if "No module named" in str(e) else str(e).splitlines()[0]
        print(f"ERROR: keyboard control unavailable ({msg})", file=sys.stderr)
        sys.exit(2)
    keyboard, Controller, Key = kbmod, C, K
    MOD = Key.cmd if SYSTEM == "Darwin" else Key.ctrl


DEFAULT_HOTKEY = "<cmd>+<alt>+p" if SYSTEM == "Darwin" else "<ctrl>+<alt>+p"

INSTRUCTIONS = """You rewrite rough prompts into polished, professional prompts for AI building tools
(Claude Design, claude.ai, Claude Code). The polished prompt will be sent as-is.

Rules:
- Keep the author's intent, requirements, names and specifics. Do not add features, facts or
  constraints they did not ask for.
- Open with one clear sentence stating the goal. Then, if the request has several parts, short
  labelled groups with bullet points. Prefer concrete details over adjectives.
- If it's a build/change request for code, end with one "Done when:" line describing how to verify it.
- Fix spelling and grammar. Plain English, confident, no filler, no emojis, no markdown headings.
- Keep it short enough to read on screen: under ~15 lines. A one-line request stays short.
- Output ONLY the polished prompt text. No preamble, no quotes, no explanation.

Rough prompt:
"""


def clipboard_get():
    try:
        if SYSTEM == "Darwin":
            return subprocess.run(["pbpaste"], capture_output=True, text=True).stdout
        if SYSTEM == "Windows":
            return subprocess.run(["powershell", "-NoProfile", "-Command", "Get-Clipboard -Raw"], capture_output=True, text=True).stdout
        cmd = ["wl-paste", "-n"] if shutil.which("wl-paste") else ["xclip", "-selection", "clipboard", "-o"]
        return subprocess.run(cmd, capture_output=True, text=True).stdout
    except Exception:
        return ""


def clipboard_set(text):
    if SYSTEM == "Darwin":
        cmd = ["pbcopy"]
    elif SYSTEM == "Windows":
        cmd = ["powershell", "-NoProfile", "-Command", "$input | Out-String | Set-Clipboard"]
    else:
        cmd = ["wl-copy"] if shutil.which("wl-copy") else ["xclip", "-selection", "clipboard"]
    subprocess.run(cmd, input=text, text=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def polish_text(rough):
    custom = os.environ.get("BUILD_REC_POLISH_CMD")
    if custom:
        cmd = shlex.split(custom)
    else:
        exe = shutil.which("claude")
        if not exe:
            raise RuntimeError("Claude Code CLI (`claude`) not found on PATH")
        cmd = [exe, "-p", "--output-format", "text"]
    r = subprocess.run(cmd, input=INSTRUCTIONS + rough.strip() + "\n", capture_output=True, text=True, timeout=120)
    out = r.stdout.strip()
    if r.returncode != 0 or not out:
        raise RuntimeError((r.stderr or "empty response").strip()[:300])
    # Strip wrapping quotes/fences if the model added any.
    if out.startswith("```"):
        out = out.strip("`").split("\n", 1)[-1].rsplit("```", 1)[0].strip()
    return out.strip().strip('"').strip()


class Polisher:
    def __init__(self, a):
        self.a = a
        self.kb = Controller()
        self.busy = False
        self.last_key = 0.0
        self.burst_start = None
        self.log_path = os.path.join(a.dir, "polish.jsonl")
        self.hotkey = keyboard.HotKey(keyboard.HotKey.parse(a.hotkey), self.trigger)

    # A "burst" is continuous typing with gaps under 4 s: its start is where the rough prompt began.
    def on_press(self, key):
        if self.busy:
            return
        now = time.time()
        if self.burst_start is None or now - self.last_key > 4.0:
            self.burst_start = now
        self.last_key = now
        self.hotkey.press(self.listener.canonical(key))

    def on_release(self, key):
        if not self.busy:
            self.hotkey.release(self.listener.canonical(key))

    def trigger(self):
        if self.busy:
            return
        self.busy = True
        t_hot, t_rough = time.time(), self.burst_start or time.time()
        threading.Thread(target=self.run, args=(t_hot, t_rough), daemon=True).start()

    def combo(self, ch):
        with self.kb.pressed(MOD):
            self.kb.tap(ch)

    def run(self, t_hot, t_rough):
        ev = {"t_rough": round(t_rough, 3), "t_hotkey": round(t_hot, 3), "mode": self.a.mode}
        try:
            time.sleep(0.35)  # let the user release the hotkey
            for k in (Key.alt, Key.shift, MOD):
                self.kb.release(k)
            saved = clipboard_get()
            clipboard_set("")
            self.combo("a")
            time.sleep(0.08)
            self.combo("c")
            time.sleep(0.25)
            rough = clipboard_get()
            if not rough.strip():
                raise RuntimeError("no text selected in the focused box")
            ev["rough"] = rough
            polished = polish_text(rough)
            ev["polished"] = polished
            ev["t_out_start"] = round(time.time(), 3)
            if self.a.mode == "paste":
                clipboard_set(polished)
                self.combo("a")
                time.sleep(0.05)
                self.combo("v")
                time.sleep(0.3)
            else:
                self.combo("a")
                self.kb.tap(Key.backspace)
                time.sleep(0.15)
                self.type_out(polished)
            ev["t_out_end"] = round(time.time(), 3)
            clipboard_set(saved)
            print(f"polished {len(rough)} → {len(polished)} chars", flush=True)
        except Exception as e:
            ev["error"] = str(e)
            print(f"polish failed: {e}", file=sys.stderr, flush=True)
        finally:
            with open(self.log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps(ev) + "\n")
            self.burst_start = None
            self.busy = False

    def type_out(self, text):
        """Type like a fast, confident person. Line breaks use Shift+Enter so the prompt isn't sent early."""
        base = 1.0 / max(5, self.a.cps)
        for ch in text:
            if ch == "\n":
                with self.kb.pressed(Key.shift):
                    self.kb.tap(Key.enter)
                time.sleep(base * 4)
                continue
            self.kb.type(ch)
            pause = base * random.uniform(0.6, 1.4)
            if ch in ".,:;":
                pause += base * 3
            time.sleep(pause)

    def serve(self):
        with keyboard.Listener(on_press=self.on_press, on_release=self.on_release) as self.listener:
            stop = os.path.join(self.a.dir, "STOP")
            while not os.path.exists(stop):
                time.sleep(0.3)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default="build-recording", type=os.path.abspath)
    ap.add_argument("--mode", choices=["type", "paste"], default="type")
    ap.add_argument("--hotkey", default=DEFAULT_HOTKEY)
    ap.add_argument("--cps", type=float, default=38, help="typing speed, characters per second")
    ap.add_argument("--test", help="polish this text once and print it (checks the Claude CLI)")
    a = ap.parse_args()
    if a.test:
        print(polish_text(a.test))
        return
    os.makedirs(a.dir, exist_ok=True)
    load_pynput()
    print(f"Polisher ready: type a rough prompt, press {a.hotkey}", flush=True)
    Polisher(a).serve()


if __name__ == "__main__":
    main()
