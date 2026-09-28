"""Stop hook bloquant (adoption veille 2026-09-07) : si le tour a touche le canal
COMOP (server.js, src/*.ps1, templates/*.pptx), rejoue npm test et bloque (exit 2)
si ca echoue. Objectif : que la regression payee le 2026-06-08/07-28 (theme1.xml
corrompu, invisible 35 jours faute de gate) ne puisse plus se reproduire en silence.
Les hooks PreToolUse existants (warn_verif_before_commit.py) sont des rappels, pas
un gate ; celui-ci l'est.
"""
import json
import subprocess
import sys
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parents[2]
COMOP_DIR = PROJECT_DIR / "comop-pptx-prototype"
WATCHED_PREFIXES = (
    "comop-pptx-prototype/server.js",
    "comop-pptx-prototype/src/",
    "comop-pptx-prototype/templates/",
)


# --- bounded stdin read (anthropics/claude-code#87289) -------------------------
try:
    sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.abspath(__file__)))
    from _stdin_borne import lire_stdin_borne as _lsb
except Exception:  # noqa: BLE001 - exported without the helper: still bounded
    def _lsb(delai=5.0, flux=None):
        import threading
        f = flux if flux is not None else sys.stdin
        boite = {}

        def _c():
            try:
                boite["v"] = f.read()
            except BaseException:  # noqa: BLE001
                boite["v"] = None
        t = threading.Thread(target=_c, daemon=True)
        t.start()
        t.join(delai)
        return None if t.is_alive() else boite.get("v")


def read_stdin_json():
    try:
        raw = _lsb(5.0)
        if raw is None:
            return {}
        if isinstance(raw, bytes):
            raw = raw.decode("utf-8", "replace")
        return json.loads(raw) if raw.strip() else {}
    except Exception:
        return {}


def touched_watched_paths():
    try:
        result = subprocess.run(
            ["git", "status", "--porcelain", "--", "comop-pptx-prototype"],
            cwd=str(PROJECT_DIR),
            capture_output=True,
            text=True,
            timeout=15,
        )
    except Exception:
        # git indisponible : ne pas bloquer sur un defaut d'outillage.
        return False
    for line in result.stdout.splitlines():
        path = line[3:].strip().strip('"')
        if path.startswith("comop-pptx-prototype/templates/"):
            if path.endswith(".pptx"):
                return True
            continue
        if any(path.startswith(prefix) for prefix in WATCHED_PREFIXES):
            return True
    return False


def main():
    payload = read_stdin_json()
    if payload.get("stop_hook_active"):
        # Deja bloque une fois sur ce tour : ne pas boucler indefiniment.
        sys.exit(0)

    if not touched_watched_paths():
        sys.exit(0)

    try:
        result = subprocess.run(
            "npm test",
            cwd=str(COMOP_DIR),
            shell=True,
            capture_output=True,
            text=True,
            timeout=180,
        )
    except Exception as exc:
        sys.stderr.write(f"gate_stop_npm_test_comop : npm test n'a pas pu etre lance ({exc}).\n")
        sys.exit(2)

    if result.returncode == 0:
        sys.exit(0)

    tail = "\n".join((result.stdout + result.stderr).splitlines()[-30:])
    sys.stderr.write(
        "npm test (comop-pptx-prototype) echoue alors que server.js/src/*.ps1/templates "
        "ont ete modifies dans le repertoire de travail.\n"
        "Corrige avant de terminer le tour (le hook re-testera au prochain arret).\n\n"
        + tail
        + "\n"
    )
    sys.exit(2)


if __name__ == "__main__":
    main()
