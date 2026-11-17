"""Where the replications database lives, and the one way to publish a new version of it.

- The master is always `data/replications_database.csv`. The site and every script read that
  file; nothing is named by date in `data/`.
- Each version also has a dated name, `replications_database_YYYY_MM_DD_HHMMSS.csv`. It is the
  version label: the last non-comment line of `data/version_history.txt` gives the label of the
  current master, and the site shows it.
- `data/backup/` (not in git) holds a copy of every version under its dated name, the current
  one included.

Use `publish_master` (a file you have written) or `write_master` (a callback that writes it).
Both archive the dated copy, replace the master and append the version_history line, in that
order, so an interrupted run never leaves a master that is not in the backup.
"""
from __future__ import annotations

import os
import shutil
import tempfile
from datetime import datetime
from typing import Callable

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.normpath(os.path.join(SCRIPT_DIR, "..", "data"))
BACKUP_DIR = os.path.join(DATA_DIR, "backup")
VERSION_HISTORY_PATH = os.path.join(DATA_DIR, "version_history.txt")
MASTER_NAME = "replications_database.csv"
MASTER_PATH = os.path.join(DATA_DIR, MASTER_NAME)


def master_path() -> str | None:
    """Path of the master CSV, or None when it does not exist yet."""
    return MASTER_PATH if os.path.exists(MASTER_PATH) else None


def current_version() -> str | None:
    """The dated label of the current master: the last non-comment line of version_history.txt."""
    if not os.path.exists(VERSION_HISTORY_PATH):
        return None
    label = None
    with open(VERSION_HISTORY_PATH, encoding="utf-8") as fh:
        for line in fh:
            name = line.split("#", 1)[0].strip()
            if name:
                label = os.path.basename(name)
    return label


def _same_bytes(a: str, b: str) -> bool:
    if os.path.getsize(a) != os.path.getsize(b):
        return False
    with open(a, "rb") as fa, open(b, "rb") as fb:
        while True:
            x, y = fa.read(1 << 20), fb.read(1 << 20)
            if x != y:
                return False
            if not x:
                return True


def ensure_current_archived() -> str | None:
    """Make sure the current master is in data/backup/ under its dated label. Returns the label.

    Refuses to overwrite a backup that differs: a dated file is never changed once written.
    """
    label = current_version()
    if not label or not os.path.exists(MASTER_PATH):
        return None
    os.makedirs(BACKUP_DIR, exist_ok=True)
    dest = os.path.join(BACKUP_DIR, label)
    if not os.path.exists(dest):
        shutil.copy2(MASTER_PATH, dest)
    elif not _same_bytes(MASTER_PATH, dest):
        raise SystemExit(
            f"data/{MASTER_NAME} differs from data/backup/{label}, the version that "
            "version_history.txt says it is. The master was changed without a new version. "
            "Publish it as a new version, or restore it from the backup, before continuing.")
    return label


def publish_master(new_csv: str, comment: str, stamp: str | None = None) -> str:
    """Make the file `new_csv` the master. Returns the new dated label.

    `new_csv` is moved, so write it somewhere temporary (`write_master` does this for you).
    """
    ensure_current_archived()
    stamp = stamp or datetime.now().strftime("%Y_%m_%d_%H%M%S")
    label = f"replications_database_{stamp}.csv"
    dest = os.path.join(BACKUP_DIR, label)
    if os.path.exists(dest):
        raise SystemExit(f"data/backup/{label} already exists; not overwriting a dated version")
    os.makedirs(BACKUP_DIR, exist_ok=True)
    shutil.copy2(new_csv, dest)
    os.chmod(new_csv, 0o644)
    shutil.move(new_csv, MASTER_PATH)
    comment = " ".join(str(comment).split()).lstrip("# ").strip()
    content = ""
    if os.path.exists(VERSION_HISTORY_PATH):
        with open(VERSION_HISTORY_PATH, encoding="utf-8") as fh:
            content = fh.read().rstrip() + "\n"
    with open(VERSION_HISTORY_PATH, "w", encoding="utf-8") as fh:
        fh.write(content + label + (f" # {comment}" if comment else "") + "\n")
    return label


def write_master(write: Callable[[str], None], comment: str, stamp: str | None = None) -> str:
    """Call `write(path)` to produce the new CSV, then publish it. Returns the new dated label."""
    os.makedirs(DATA_DIR, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".replications_database.", suffix=".tmp", dir=DATA_DIR)
    os.close(fd)
    try:
        write(tmp)
        return publish_master(tmp, comment, stamp)
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)
