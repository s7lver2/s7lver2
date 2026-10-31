#!/usr/bin/env python3
"""
Hornea la luz indirecta de la habitación del hero. Se ejecuta y ya está:

    python tools/bake_lighting.py

1. Si no hay Blender, descarga uno portable de blender.org en tools/.blender/.
2. Si el servidor de desarrollo no está en marcha, lo arranca (npm run dev).
3. Abre la página con ?bake en un Edge/Chrome sin ventana: la escena se monta igual que
   para un visitante y sube a tools/.bake/ su geometría y sus luces fijas.
4. Blender, sin interfaz, desenvuelve un atlas común, hornea la luz indirecta con Cycles
   y deja en public/models/room/bake/ el atlas (lightmap.webp) y las coordenadas (uv.bin, index.json).

No depende de qué modelos haya: hornea lo que la escena tenga montado. Si cambias o añades
modelos, vuelve a ejecutarlo. Opciones: --size 2048 --samples 256 --gain 1.0 --port 3000
"""
import argparse
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
import zipfile
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent  # webpage/
TOOLS = ROOT / "tools"
BLENDER_DIR = TOOLS / ".blender"
EXPORT_DIR = TOOLS / ".bake"
OUT_DIR = ROOT / "public" / "models" / "room" / "bake"
RELEASES = "https://download.blender.org/release/"
BLENDER_MAJOR = "4"  # la API de horneado que usa bake_blender.py es la de la serie 4


def log(msg):
    print(f"[bake] {msg}", flush=True)


# ─────────────────────────────── Blender

def find_blender():
    env = os.environ.get("BLENDER")
    if env and Path(env).exists():
        return Path(env)
    exe = "blender.exe" if os.name == "nt" else "blender"
    local = sorted(BLENDER_DIR.glob(f"*/{exe}"))
    if local:
        return local[-1]
    found = shutil.which("blender")
    if found:
        return Path(found)
    if os.name == "nt":
        for base in (os.environ.get("ProgramFiles", r"C:\Program Files"), os.environ.get("LOCALAPPDATA", "")):
            hits = sorted(Path(base, "Blender Foundation").glob("Blender*/blender.exe")) if base else []
            if hits:
                return hits[-1]
    if sys.platform == "darwin":
        mac = Path("/Applications/Blender.app/Contents/MacOS/Blender")
        if mac.exists():
            return mac
    return None


def download_blender():
    if sys.platform == "darwin":
        sys.exit("[bake] En macOS instala Blender en /Applications (o pon su ruta en la variable BLENDER).")
    suffix = "windows-x64.zip" if os.name == "nt" else "linux-x64.tar.xz"
    index = urllib.request.urlopen(RELEASES).read().decode()
    series = sorted(
        {m for m in re.findall(r'href="Blender(\d+\.\d+)/"', index) if m.startswith(BLENDER_MAJOR + ".")},
        key=lambda v: tuple(map(int, v.split("."))),
    )
    for s in reversed(series):
        page = urllib.request.urlopen(f"{RELEASES}Blender{s}/").read().decode()
        files = sorted(
            set(re.findall(rf'href="(blender-{re.escape(s)}\.\d+-{suffix})"', page)),
            key=lambda f: int(re.search(rf"{re.escape(s)}\.(\d+)", f).group(1)),
        )
        if files:
            url = f"{RELEASES}Blender{s}/{files[-1]}"
            break
    else:
        sys.exit("[bake] No encuentro una versión de Blender para descargar.")
    BLENDER_DIR.mkdir(parents=True, exist_ok=True)
    archive = BLENDER_DIR / url.rsplit("/", 1)[1]
    log(f"descargando {url} (unos 350 MB, solo la primera vez)")
    with urllib.request.urlopen(url) as r, open(archive, "wb") as f:
        total = int(r.headers.get("Content-Length", 0))
        done = 0
        while chunk := r.read(1 << 20):
            f.write(chunk)
            done += len(chunk)
            if total:
                print(f"\r[bake] {done * 100 // total:3d}%", end="", flush=True)
    print()
    log("descomprimiendo")
    if archive.suffix == ".zip":
        with zipfile.ZipFile(archive) as z:
            z.extractall(BLENDER_DIR)
    else:
        with tarfile.open(archive) as t:
            t.extractall(BLENDER_DIR)
    archive.unlink()
    return find_blender()


# ─────────────────────────────── servidor y navegador

def port_open(port):
    with socket.socket() as s:
        s.settimeout(0.5)
        return s.connect_ex(("127.0.0.1", port)) == 0


def ensure_server(port):
    if port_open(port):
        return None
    log(f"arrancando el servidor de desarrollo en :{port}")
    npm = "npm.cmd" if os.name == "nt" else "npm"
    proc = subprocess.Popen([npm, "run", "dev", "--", "-p", str(port)], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(120):
        if port_open(port):
            return proc
        time.sleep(1)
    proc.terminate()
    sys.exit("[bake] El servidor de desarrollo no arranca.")


def find_browser():
    cands = []
    if os.name == "nt":
        for base in (os.environ.get("ProgramFiles(x86)", ""), os.environ.get("ProgramFiles", ""), os.environ.get("LOCALAPPDATA", "")):
            if base:
                cands += [Path(base, "Microsoft/Edge/Application/msedge.exe"), Path(base, "Google/Chrome/Application/chrome.exe")]
    elif sys.platform == "darwin":
        cands += [Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"), Path("/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge")]
    for name in ("google-chrome", "chromium", "chromium-browser", "microsoft-edge"):
        if shutil.which(name):
            cands.append(Path(shutil.which(name)))
    return next((c for c in cands if c.exists()), None)


def export_scene(port):
    browser = find_browser()
    if not browser:
        sys.exit("[bake] Hace falta Chrome o Edge para montar la escena.")
    meta = EXPORT_DIR / "meta.json"
    start = time.time()
    profile = tempfile.mkdtemp(prefix="bake-profile-")
    url = f"http://localhost:{port}/?bake"
    # primero con la gráfica de verdad; si no exporta, con el renderizador por software
    for flags in (["--use-angle=default", "--ignore-gpu-blocklist"], ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]):
        log(f"montando la escena en {browser.name} ({flags[0]})")
        proc = subprocess.Popen(
            [str(browser), "--headless=new", f"--user-data-dir={profile}", "--no-first-run", "--window-size=1280,800", "--autoplay-policy=no-user-gesture-required", *flags, url],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        try:
            for _ in range(240):
                if meta.exists() and meta.stat().st_mtime > start:
                    time.sleep(1)  # que termine de escribir
                    return
                time.sleep(0.5)
        finally:
            proc.terminate()
            proc.wait(timeout=10)
    shutil.rmtree(profile, ignore_errors=True)
    sys.exit("[bake] La página no ha exportado la escena (¿errores en la consola con ?bake?).")


# ─────────────────────────────── main

def main():
    ap = argparse.ArgumentParser(description="Hornea la luz indirecta de la habitación.")
    ap.add_argument("--size", type=int, default=2048, help="lado del atlas en píxeles")
    ap.add_argument("--samples", type=int, default=160, help="muestras de Cycles por píxel")
    ap.add_argument("--gain", type=float, default=1.0, help="multiplica la luz horneada")
    ap.add_argument("--port", type=int, default=3000)
    ap.add_argument("--skip-export", action="store_true", help="reutiliza la última escena exportada")
    a = ap.parse_args()

    blender = find_blender() or download_blender()
    log(f"Blender: {blender}")

    server = None
    if not a.skip_export:
        server = ensure_server(a.port)
        try:
            export_scene(a.port)
        finally:
            if server:
                server.terminate()
    log(f"escena exportada: {json.loads((EXPORT_DIR / 'meta.json').read_text())['meshes'].__len__()} mallas")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    cmd = [str(blender), "-b", "--factory-startup", "-noaudio", "--python-exit-code", "1", "--python", str(TOOLS / "bake_blender.py"), "--",
           str(EXPORT_DIR), str(OUT_DIR), str(a.size), str(a.samples), str(a.gain)]
    log("horneando en Blender (puede tardar unos minutos)")
    r = subprocess.run(cmd)
    if r.returncode != 0:
        sys.exit("[bake] Blender ha fallado; mira el registro de arriba.")
    log(f"listo: {OUT_DIR.relative_to(ROOT)}  (recarga la página)")


if __name__ == "__main__":
    main()
