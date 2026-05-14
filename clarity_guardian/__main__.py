"""Совместимый CLI для `python -m clarity_guardian`.

Основная логика проекта живёт в TypeScript-модулях. Этот wrapper оставляет
понятные demo-команды из README и не дублирует бизнес-логику.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path


SUPPORTED_FORMATS = {"markdown", "json", "csv"}


def print_help() -> None:
    print(
        "\n".join(
            [
                "Clarity Guardian V2 CLI",
                "",
                "Команды:",
                "  python -m clarity_guardian analyze --input data/demo_tasks.json --output reports/clarity_report.md",
                "  python -m clarity_guardian retro --input data/demo_tasks.json --output reports/retro_report.md",
                "",
                "Форматы отчётов: markdown, json, csv.",
            ]
        )
    )


def get_arg(args: list[str], name: str) -> str | None:
    try:
        index = args.index(name)
    except ValueError:
        return None

    if index + 1 >= len(args) or args[index + 1].startswith("--"):
        return None

    return args[index + 1]


def infer_format(output_path: Path, explicit_format: str | None) -> str:
    if explicit_format:
        if explicit_format not in SUPPORTED_FORMATS:
            raise ValueError(f"Неподдерживаемый формат отчёта: {explicit_format}")
        return explicit_format

    extension = output_path.suffix.lower()
    if extension == ".md":
        return "markdown"
    if extension == ".json":
        return "json"
    if extension == ".csv":
        return "csv"

    raise ValueError("Неподдерживаемый формат отчёта: укажи --format markdown|json|csv")


def run_command(command: list[str], root_dir: Path) -> int:
    return subprocess.run(command, cwd=root_dir, check=False).returncode


def run_command_quiet(command: list[str], root_dir: Path) -> int:
    result = subprocess.run(
        command,
        cwd=root_dir,
        check=False,
        text=True,
        capture_output=True,
    )

    if result.returncode != 0:
        if result.stdout:
            print(result.stdout, end="")
        if result.stderr:
            print(result.stderr, end="", file=sys.stderr)

    return result.returncode


def ensure_build(root_dir: Path) -> int:
    return run_command(["npm", "run", "build", "--silent"], root_dir)


def run_retro(root_dir: Path, args: list[str]) -> int:
    build_status = ensure_build(root_dir)
    if build_status != 0:
        return build_status

    return run_command(["node", "dist/retro-report.js", *args], root_dir)


def run_analyze(root_dir: Path, args: list[str]) -> int:
    input_path = get_arg(args, "--input")
    output_path_raw = get_arg(args, "--output")

    if not input_path:
        print("Не передан аргумент --input", file=sys.stderr)
        return 2

    if not output_path_raw:
        print("Не передан аргумент --output", file=sys.stderr)
        return 2

    output_path = Path(output_path_raw)
    if not output_path.is_absolute():
        output_path = root_dir / output_path

    try:
        report_format = infer_format(output_path, get_arg(args, "--format"))
    except ValueError as error:
        print(str(error), file=sys.stderr)
        return 2

    build_status = ensure_build(root_dir)
    if build_status != 0:
        return build_status

    output_path.parent.mkdir(parents=True, exist_ok=True)
    temp_dir = output_path.parent / f".clarity-guardian-analyze-{output_path.stem}"

    if temp_dir.exists():
        shutil.rmtree(temp_dir)

    try:
        report_status = run_command_quiet(
            [
                "node",
                "dist/v2-report.js",
                "--input",
                input_path,
                "--out-dir",
                str(temp_dir),
            ],
            root_dir,
        )

        if report_status != 0:
            return report_status

        source_by_format = {
            "markdown": temp_dir / "dashboard.md",
            "json": temp_dir / "dashboard.json",
            "csv": temp_dir / "tasks.csv",
        }
        shutil.copyfile(source_by_format[report_format], output_path)
        print(f"Отчёт Clarity Guardian сохранён: {output_path}")
        return 0
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def main() -> int:
    root_dir = Path(__file__).resolve().parent.parent
    command = sys.argv[1] if len(sys.argv) > 1 else ""
    args = sys.argv[2:]

    if not command or command in {"--help", "-h"}:
        print_help()
        return 0

    if command == "retro":
        return run_retro(root_dir, args)

    if command == "analyze":
        return run_analyze(root_dir, args)

    print("Поддерживаются команды: analyze, retro", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
