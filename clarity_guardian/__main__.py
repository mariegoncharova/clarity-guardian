"""Совместимый CLI для `python -m clarity_guardian retro`.

Основная аналитика живёт в TypeScript-модулях. Этот wrapper оставляет доступной
demo-команду из product brief и не дублирует бизнес-логику.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def main() -> int:
    root_dir = Path(__file__).resolve().parent.parent
    command = sys.argv[1] if len(sys.argv) > 1 else ""

    if command != "retro":
        print("Поддерживается команда: python -m clarity_guardian retro ...", file=sys.stderr)
        return 2

    build = subprocess.run(
        ["npm", "run", "build", "--silent"],
        cwd=root_dir,
        check=False,
    )

    if build.returncode != 0:
        return build.returncode

    return subprocess.run(
        ["node", "dist/retro-report.js", *sys.argv[2:]],
        cwd=root_dir,
        check=False,
    ).returncode


if __name__ == "__main__":
    raise SystemExit(main())
