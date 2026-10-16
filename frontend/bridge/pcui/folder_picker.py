"""Desktop folder picker isolated from the bridge's event loop and SQLite threads."""
from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import sys
import threading

from .workspace import WorkspaceError, workspace_path

_lock = threading.Lock()
_TITLES = {"zh": "选择工作区文件夹", "en": "Choose workspace folder", "ja": "ワークスペースのフォルダを選択"}


def choose_folder(initial: Path, lang: str) -> str | None:
    if not _lock.acquire(blocking=False):
        raise WorkspaceError("folder_picker_busy")
    try:
        process = subprocess.run(
            [sys.executable, "-m", "pcui.folder_picker"],
            input=json.dumps({"initial": str(initial), "title": _TITLES[lang]}),
            text=True, encoding="utf-8", capture_output=True, timeout=600,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
        )
        if process.returncode:
            raise WorkspaceError("folder_picker_unavailable", 422)
        result = json.loads(process.stdout)
        if result is None:
            return None
        path = workspace_path(result)
        if not path.is_dir():
            raise WorkspaceError("folder_picker_unavailable", 422)
        return str(path)
    except (OSError, ValueError, subprocess.TimeoutExpired) as exc:
        raise WorkspaceError("folder_picker_unavailable", 422) from exc
    finally:
        _lock.release()


def main():
    import tkinter as tk
    from tkinter import filedialog
    request = json.load(sys.stdin)
    root = tk.Tk()
    root.withdraw()
    try:
        root.attributes("-topmost", True)
        folder = filedialog.askdirectory(parent=root, initialdir=request["initial"], title=request["title"], mustexist=True)
        print(json.dumps(folder or None, ensure_ascii=True), flush=True)
    finally:
        root.destroy()


if __name__ == "__main__":
    main()
