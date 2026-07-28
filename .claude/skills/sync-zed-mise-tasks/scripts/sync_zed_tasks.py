#!/usr/bin/env python3
"""Regenerate .zed/tasks.json from mise.toml so Zed's task list mirrors mise's.

mise.toml is the source of truth for *which* tasks exist and how they are grouped.
Per-task Zed options come from three places, highest precedence first:

  1. a `# zed: key = value, ...` comment attached to the task in mise.toml
  2. whatever the task already had in .zed/tasks.json (hand-tuning is preserved)
  3. safe defaults for brand-new tasks

Run with --dry-run first: it prints the planned changes and a unified diff without
touching anything. --check does the same but exits 1 when out of sync, for CI.

Pure stdlib, Python 3.11+ (needs tomllib).
"""

from __future__ import annotations

import argparse
import difflib
import json
import re
import shlex
import sys
import tomllib
from pathlib import Path

# Fields Zed accepts on a task object, in the order we emit them.
# Anything else found in an existing tasks.json is preserved and emitted last,
# so a new Zed release adding a field never causes us to silently drop it.
CANONICAL_FIELD_ORDER = [
    "label",
    "command",
    "args",
    "env",
    "cwd",
    "use_new_terminal",
    "allow_concurrent_runs",
    "reveal",
    "reveal_target",
    "hide",
    "shell",
    "show_summary",
    "show_command",
    "save",
    "tags",
    "hooks",
    "reevaluate_context",
]
KNOWN_ZED_FIELDS = set(CANONICAL_FIELD_ORDER)

# mise config files we read tasks from, in discovery order. mise.local.toml is
# deliberately excluded: it is developer-local, and .zed/tasks.json is committed.
MISE_CONFIG_NAMES = [
    "mise.toml",
    ".mise.toml",
    ".config/mise.toml",
    ".config/mise/config.toml",
]
LOCAL_CONFIG_NAMES = ["mise.local.toml", ".mise.local.toml"]

# Directories mise picks up file-based tasks from. We must know about these or we
# would treat their Zed mirrors as stale and delete them.
FILE_TASK_DIRS = ["mise-tasks", ".mise-tasks", ".mise/tasks", ".config/mise/tasks"]

# A task that keeps running until you stop it should not be launchable twice over.
# Zed's own default for allow_concurrent_runs is already false, so we only spell it
# out for these — it documents intent where it matters and keeps the file quiet
# everywhere else.
LONG_RUNNING_PATTERNS = [
    r"docker\s+compose\s+up",
    r"docker\s+run",
    r"(?:^|\s)-t(?:\s|$)",
    r"--continuous",
    r"--watch",
    r"(?:^|\s)-w(?:\s|$)",
    r"\bnodemon\b",
    r"\bwatch\b",
    r"\bserver?\b",
    r"\bdev\b",
    r"\bstart\b",
]

SECTION_RE = re.compile(r"^#\s*-{2,}\s*(.*?)\s*-{2,}\s*$")
HINT_RE = re.compile(r"^#\s*zed:\s*(.*)$", re.IGNORECASE)
# [tasks.name] / [tasks."name"] / [tasks.'name'] — but not [tasks.name.env]
TASK_HEADER_RE = re.compile(r"""^\[tasks\.(?:"([^"]+)"|'([^']+)'|([^.\]"']+))\]\s*$""")
TABLE_HEADER_RE = re.compile(r"^\[")


class SyncError(Exception):
    """A problem the user needs to fix before syncing can work."""


# --------------------------------------------------------------------------- #
# JSONC reading
# --------------------------------------------------------------------------- #


def strip_jsonc(text: str) -> str:
    """Remove // and /* */ comments, and trailing commas, without touching strings."""
    out: list[str] = []
    i, n = 0, len(text)
    in_string = False
    while i < n:
        ch = text[i]
        if in_string:
            if ch == "\\" and i + 1 < n:
                out.append(text[i: i + 2])
                i += 2
                continue
            if ch == '"':
                in_string = False
            out.append(ch)
            i += 1
            continue
        if ch == '"':
            in_string = True
            out.append(ch)
            i += 1
            continue
        if ch == "/" and i + 1 < n and text[i + 1] == "/":
            while i < n and text[i] != "\n":
                i += 1
            continue
        if ch == "/" and i + 1 < n and text[i + 1] == "*":
            i += 2
            while i + 1 < n and not (text[i] == "*" and text[i + 1] == "/"):
                i += 1
            i += 2
            continue
        out.append(ch)
        i += 1
    return _drop_trailing_commas("".join(out))


def _drop_trailing_commas(text: str) -> str:
    out: list[str] = []
    i, n = 0, len(text)
    in_string = False
    while i < n:
        ch = text[i]
        if in_string:
            if ch == "\\" and i + 1 < n:
                out.append(text[i: i + 2])
                i += 2
                continue
            if ch == '"':
                in_string = False
            out.append(ch)
            i += 1
            continue
        if ch == '"':
            in_string = True
            out.append(ch)
            i += 1
            continue
        if ch == ",":
            j = i + 1
            while j < n and text[j] in " \t\r\n":
                j += 1
            if j < n and text[j] in "}]":
                i += 1  # drop the comma
                continue
        out.append(ch)
        i += 1
    return "".join(out)


def read_existing_tasks(path: Path) -> tuple[list[dict], list[str]]:
    """Return (task objects, leading header comment lines) from a JSONC tasks file."""
    if not path.exists():
        return [], []
    raw = path.read_text(encoding="utf-8")

    header: list[str] = []
    for line in raw.splitlines():
        stripped = line.strip()
        if not stripped:
            if header:
                break
            continue
        if stripped.startswith("//"):
            header.append(line.rstrip())
            continue
        break

    try:
        data = json.loads(strip_jsonc(raw) or "[]")
    except json.JSONDecodeError as exc:
        raise SyncError(
            f"{path} is not valid JSON (after comment stripping): {exc}\n"
            "Fix the syntax by hand first — refusing to overwrite a file I can't read."
        ) from exc

    if data is None:
        data = []
    if not isinstance(data, list):
        raise SyncError(f"{path} must contain a JSON array of tasks, got {type(data).__name__}.")
    for entry in data:
        if not isinstance(entry, dict):
            raise SyncError(f"{path} contains a non-object array entry: {entry!r}")
    return data, header


# --------------------------------------------------------------------------- #
# mise reading
# --------------------------------------------------------------------------- #


def find_project_root(start: Path) -> Path:
    for candidate in [start, *start.parents]:
        if any((candidate / name).exists() for name in MISE_CONFIG_NAMES):
            return candidate
    raise SyncError(
        f"No mise config found in {start} or any parent directory "
        f"(looked for: {', '.join(MISE_CONFIG_NAMES)})."
    )


def find_mise_config(root: Path) -> Path:
    for name in MISE_CONFIG_NAMES:
        path = root / name
        if path.exists():
            return path
    raise SyncError(f"No mise config in {root} (looked for: {', '.join(MISE_CONFIG_NAMES)}).")


def parse_hint(body: str, task: str, warnings: list[str]) -> dict:
    """Parse the text after `# zed:` into a dict of Zed task fields.

    Accepts TOML inline-table syntax without the braces:
        # zed: allow_concurrent_runs = true, reveal = "never"
    and the bare shorthand:
        # zed: skip
    """
    body = body.strip().rstrip(",")
    if not body:
        return {}
    if body.lower() in {"skip", "ignore", "none"}:
        return {"skip": True}
    try:
        parsed = tomllib.loads(f"hint = {{ {body} }}")["hint"]
    except tomllib.TOMLDecodeError as exc:
        warnings.append(
            f"task {task!r}: could not parse `# zed: {body}` ({exc}); hint ignored. "
            'Expected TOML pairs, e.g. `# zed: reveal = "never", allow_concurrent_runs = true`.'
        )
        return {}
    for key in parsed:
        if key not in KNOWN_ZED_FIELDS and key != "skip":
            warnings.append(
                f"task {task!r}: `{key}` is not a field Zed is known to accept; "
                "passing it through unchanged."
            )
    return parsed


def scan_mise_layout(text: str, warnings: list[str]) -> list[tuple]:
    """Walk mise.toml line by line to recover task order, section comments, and hints.

    tomllib tells us what the tasks *are*; only the raw text tells us how the author
    grouped and annotated them, and that grouping is what makes the Zed list readable.
    """
    entries: list[tuple] = []
    pending_comments: list[str] = []
    current_task: str | None = None

    for line in text.splitlines():
        stripped = line.strip()

        if not stripped:
            # A blank line ends comment attribution. TOML-wise the table continues, but
            # a `# zed:` comment sitting after a blank line reads as a header for the task
            # *below* it, and that is what the author meant. Getting this wrong is not
            # cosmetic: a misattributed `# zed: skip` drops the wrong task.
            pending_comments = []
            current_task = None
            continue

        if stripped.startswith("#"):
            section = SECTION_RE.match(stripped)
            if section and section.group(1):
                entries.append(("section", section.group(1).strip()))
                pending_comments = []
                current_task = None
                continue
            hint = HINT_RE.match(stripped)
            if hint:
                if current_task is not None:
                    # hint sits inside the task's own block
                    for idx in range(len(entries) - 1, -1, -1):
                        if entries[idx][0] == "task" and entries[idx][1] == current_task:
                            entries[idx][2].update(parse_hint(hint.group(1), current_task, warnings))
                            break
                else:
                    pending_comments.append(hint.group(1))
            continue

        header = TASK_HEADER_RE.match(stripped)
        if header:
            name = header.group(1) or header.group(2) or header.group(3)
            hints: dict = {}
            for body in pending_comments:
                hints.update(parse_hint(body, name, warnings))
            entries.append(("task", name, hints))
            current_task = name
            pending_comments = []
            continue

        if TABLE_HEADER_RE.match(stripped):
            # any other table ([tools], [tasks.x.env], [env], ...) ends the task block
            current_task = None
            pending_comments = []
            continue

        pending_comments = []

    return entries


def discover_file_tasks(root: Path) -> list[str]:
    """Task names mise picks up from file-task directories."""
    names: list[str] = []
    for rel in FILE_TASK_DIRS:
        base = root / rel
        if not base.is_dir():
            continue
        for path in sorted(base.rglob("*")):
            if path.is_file() and not path.name.startswith("."):
                parts = path.relative_to(base).with_suffix("").parts
                names.append(":".join(parts))
    return names


def load_mise_tasks(config: Path, root: Path, warnings: list[str]) -> tuple[dict, list[tuple]]:
    text = config.read_text(encoding="utf-8")
    try:
        data = tomllib.loads(text)
    except tomllib.TOMLDecodeError as exc:
        raise SyncError(f"{config} is not valid TOML: {exc}") from exc

    tasks = data.get("tasks", {})
    if not isinstance(tasks, dict):
        raise SyncError(f"{config}: [tasks] must be a table, got {type(tasks).__name__}.")

    layout = scan_mise_layout(text, warnings)
    seen = {name for kind, name, *_ in layout if kind == "task"}

    # Tasks tomllib knows about but the line scan missed (e.g. `[tasks]` shorthand),
    # plus file-based tasks: append so they still get mirrored.
    for name in tasks:
        if name not in seen:
            layout.append(("task", name, {}))
            seen.add(name)
    for name in discover_file_tasks(root):
        if name not in seen:
            layout.append(("task", name, {}))
            seen.add(name)
            tasks.setdefault(name, {})

    for name in LOCAL_CONFIG_NAMES:
        if (root / name).exists():
            warnings.append(
                f"{name} exists; its tasks are intentionally not mirrored because "
                ".zed/tasks.json is committed and those tasks are machine-local."
            )

    return tasks, layout


# --------------------------------------------------------------------------- #
# Building the desired task list
# --------------------------------------------------------------------------- #


def run_text(spec) -> str:
    if isinstance(spec, dict):
        parts = [spec.get("run", ""), spec.get("run_windows", "")]
        raw = [p for p in parts if p]
    else:
        raw = [spec]
    flat: list[str] = []
    for item in raw:
        if isinstance(item, list):
            flat.extend(str(x) for x in item)
        elif item:
            flat.append(str(item))
    return " ".join(flat)


def looks_long_running(name: str, spec) -> bool:
    """Guess whether a task runs until stopped, so we can spell out no-concurrent-runs.

    The task's own name is part of the evidence: `serve` running `python -m http.server`
    gives the game away in the label, not the command. Guessing wrong costs nothing —
    false is already Zed's default, so a false positive only makes it explicit.
    """
    text = f"{name} {run_text(spec)}"
    return any(re.search(pattern, text) for pattern in LONG_RUNNING_PATTERNS)


def mise_command(name: str) -> str:
    return f"mise run {shlex.quote(name) if re.search(r'[\s\"\']', name) else name}"


def is_mise_mirror(task: dict) -> str | None:
    """If this Zed task delegates to a mise task, return that task's name."""
    command = task.get("command")
    if not isinstance(command, str):
        return None
    match = re.match(r"^\s*mise\s+run\s+(.+?)\s*$", command)
    if not match:
        return None
    try:
        parts = shlex.split(match.group(1))
    except ValueError:
        return None
    for part in parts:
        if not part.startswith("-"):
            return part
    return None


def show(value) -> str:
    """Format a value the way it will appear in the JSON file, for change notes."""
    return json.dumps(value, ensure_ascii=False)


def order_fields(task: dict, template: dict | None = None) -> dict:
    """Order a task's fields for output.

    When the task already existed, follow the order the author had it in: rewriting
    `reveal` above `allow_concurrent_runs` is a diff with no meaning, and noise like
    that trains people to skim the diff instead of reading it. Only fields the author
    never had get placed by our canonical order.
    """
    order: list[str] = []
    if template:
        order = ["label", "command"] + [k for k in template if k not in ("label", "command")]
    for key in CANONICAL_FIELD_ORDER:
        if key not in order:
            order.append(key)

    ordered = {key: task[key] for key in order if key in task}
    for key in sorted(k for k in task if k not in ordered):
        ordered[key] = task[key]
    return ordered


def build_plan(mise_tasks: dict, layout: list[tuple], existing: list[dict], warnings: list[str]):
    by_label = {t["label"]: t for t in existing if isinstance(t.get("label"), str)}
    plan: list[tuple] = []
    changes: list[dict] = []
    emitted: set[str] = set()

    for entry in layout:
        if entry[0] == "section":
            plan.append(("section", entry[1]))
            continue

        _, name, hints = entry
        if name in emitted:
            continue
        spec = mise_tasks.get(name, {})

        if isinstance(spec, dict) and spec.get("hide") is True:
            continue
        if hints.get("skip"):
            continue

        emitted.add(name)
        previous = by_label.get(name)

        task: dict = {"label": name, "command": mise_command(name)}
        field_notes: list[str] = []

        if previous:
            for key, value in previous.items():
                if key not in ("label", "command"):
                    task[key] = value
            if previous.get("command") != task["command"]:
                field_notes.append(
                    f"command: {show(previous.get('command'))} → {show(task['command'])}"
                )
        else:
            task["reveal"] = "always"
            if looks_long_running(name, spec):
                task["allow_concurrent_runs"] = False

        for key, value in hints.items():
            if key == "skip":
                continue
            if previous and key in previous and previous[key] != value:
                field_notes.append(
                    f"{key}: {show(previous[key])} → {show(value)} (hint in mise.toml)"
                )
            elif previous and key not in previous:
                field_notes.append(f"{key}: + {show(value)} (hint in mise.toml)")
            task[key] = value

        task = order_fields(task, previous)
        plan.append(("task", task))

        if previous is None:
            changes.append({"kind": "add", "label": name, "note": run_text(spec)})
        elif field_notes:
            changes.append({"kind": "update", "label": name, "note": "; ".join(field_notes)})
        else:
            changes.append({"kind": "keep", "label": name, "note": ""})

    # Tasks already in .zed/tasks.json that mise no longer knows about.
    # Only delete ones that were clearly mirrors; hand-written Zed tasks survive.
    orphans: list[dict] = []
    for task in existing:
        label = task.get("label")
        if not isinstance(label, str) or label in emitted:
            continue
        mirrored = is_mise_mirror(task)
        if mirrored is not None and mirrored not in mise_tasks:
            changes.append(
                {
                    "kind": "remove",
                    "label": label,
                    "note": f"no `{mirrored}` task in mise config",
                }
            )
        else:
            orphans.append(order_fields(task, task))
            changes.append(
                {"kind": "keep-extra", "label": label, "note": "hand-written, not a mise mirror"}
            )

    if orphans:
        plan.append(("section", "Zed-only (not backed by mise)"))
        for task in orphans:
            plan.append(("task", task))

    return plan, changes


# --------------------------------------------------------------------------- #
# Rendering
# --------------------------------------------------------------------------- #

DEFAULT_HEADER = [
    "// Project tasks — one per mise task (see mise.toml). Each delegates to `mise run <task>`.",
    "// Generated by .claude/skills/sync-zed-mise-tasks; edit mise.toml, then re-run the sync.",
    '// Run via the Zed command palette: "task: spawn". See https://zed.dev/docs/tasks.',
]

INLINE_VALUE_BUDGET = 72


def render_value(value, indent: int) -> str:
    """Render one field value, keeping short objects/arrays on a single line.

    Expanding `{ "FOO": "bar" }` across three lines is a diff that says nothing, and
    a review full of nothing-diffs is a review nobody reads carefully.
    """
    compact = json.dumps(value, ensure_ascii=False)
    if len(compact) <= INLINE_VALUE_BUDGET:
        if compact.startswith("{") and compact != "{}":
            return "{ " + compact[1:-1] + " }"
        return compact
    lines = json.dumps(value, indent=2, ensure_ascii=False).splitlines()
    pad = " " * indent
    return lines[0] + "".join(f"\n{pad}{line}" for line in lines[1:])


def render_task(task: dict) -> list[str]:
    lines = ["  {"]
    items = list(task.items())
    for position, (key, value) in enumerate(items):
        comma = "," if position < len(items) - 1 else ""
        lines.append(f"    {json.dumps(key)}: {render_value(value, 4)}{comma}")
    lines.append("  }")
    return lines


def render(plan: list[tuple], header: list[str]) -> str:
    lines: list[str] = list(header or DEFAULT_HEADER)
    lines.append("[")

    task_indexes = [i for i, item in enumerate(plan) if item[0] == "task"]
    last_task = task_indexes[-1] if task_indexes else None

    for index, item in enumerate(plan):
        if item[0] == "section":
            lines.append(f"  // --- {item[1]} ---")
            continue
        block = render_task(item[1])
        if index != last_task:
            block[-1] += ","
        lines.extend(block)

    lines.append("]")
    return "\n".join(lines) + "\n"


def drop_empty_trailing_sections(plan: list[tuple]) -> list[tuple]:
    """A section comment with no tasks under it is just noise."""
    keep: list[tuple] = []
    for index, item in enumerate(plan):
        if item[0] == "section":
            if not any(later[0] == "task" for later in plan[index + 1:]):
                continue
            if plan[index + 1][0] == "section":
                continue
        keep.append(item)
    return keep


# --------------------------------------------------------------------------- #
# Reporting
# --------------------------------------------------------------------------- #

SYMBOLS = {"add": "+ add", "remove": "- remove", "update": "~ update", "keep-extra": "* keep"}
SECTION_COMMENT_RE = re.compile(r"^\s*//\s*-{2,}\s*(.*?)\s*-{2,}\s*$")


def section_titles(text: str) -> list[str]:
    return [m.group(1) for m in (SECTION_COMMENT_RE.match(l) for l in text.splitlines()) if m]


def report(changes: list[dict], warnings: list[str], before: str, after: str, stream) -> None:
    def emit(text: str = "") -> None:
        print(text, file=stream)

    interesting = [c for c in changes if c["kind"] != "keep"]
    kept = [c for c in changes if c["kind"] == "keep"]

    for change in interesting:
        emit(f"  {SYMBOLS[change['kind']]:<10} {change['label']:<26} {change['note']}")

    if kept:
        labels = ", ".join(c["label"] for c in kept)
        emit(f"  {'= unchanged':<10} {len(kept)} task(s): {labels}")

    # Group headings come from mise.toml's own `# --- ... ---` comments, so rewording a
    # comment there reshapes this file. Call it out — a heading change is easy to miss
    # in the diff and looks alarming when nobody said it was coming.
    old_sections, new_sections = section_titles(before), section_titles(after)
    if old_sections != new_sections:
        emit()
        emit("  section headings follow mise.toml's `# --- ... ---` comments:")
        for title in new_sections:
            if title not in old_sections:
                emit(f"    + {title}")
        for title in old_sections:
            if title not in new_sections:
                emit(f"    - {title}")

    if not interesting and before == after:
        emit("  already in sync — nothing to do")

    if warnings:
        emit()
        for warning in warnings:
            emit(f"  ! {warning}")

    if before != after:
        emit()
        diff = difflib.unified_diff(
            before.splitlines(keepends=True),
            after.splitlines(keepends=True),
            fromfile="a/.zed/tasks.json",
            tofile="b/.zed/tasks.json",
        )
        emit("".join(diff).rstrip())


# --------------------------------------------------------------------------- #


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Regenerate .zed/tasks.json from mise.toml.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Per-task Zed options, highest precedence first:\n"
            "  1. `# zed: key = value, ...` comment on the task in mise.toml\n"
            "  2. the task's existing entry in .zed/tasks.json\n"
            "  3. safe defaults for new tasks\n"
        ),
    )
    parser.add_argument(
        "--project-root",
        type=Path,
        default=None,
        help="Project root (default: search upward from the current directory).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the plan and diff without writing.",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Like --dry-run, but exit 1 when out of sync (for CI).",
    )
    args = parser.parse_args(argv)

    try:
        root = args.project_root.resolve() if args.project_root else find_project_root(Path.cwd())
        config = find_mise_config(root)
        tasks_path = root / ".zed" / "tasks.json"

        warnings: list[str] = []
        existing, header = read_existing_tasks(tasks_path)
        mise_tasks, layout = load_mise_tasks(config, root, warnings)

        if not mise_tasks:
            raise SyncError(
                f"{config} defines no tasks. Refusing to write an empty .zed/tasks.json — "
                "if that is really what you want, delete the file by hand."
            )

        plan, changes = build_plan(mise_tasks, layout, existing, warnings)
        plan = drop_empty_trailing_sections(plan)
        after = render(plan, header)
        before = tasks_path.read_text(encoding="utf-8") if tasks_path.exists() else ""
    except SyncError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    total_before = len([t for t in existing if isinstance(t.get("label"), str)])
    total_after = len([1 for kind, _ in ((i[0], i[1]) for i in plan) if kind == "task"])

    print(f"{config.relative_to(root)} → {tasks_path.relative_to(root)}")
    print()
    report(changes, warnings, before, after, sys.stdout)
    print()

    in_sync = before == after
    if args.check:
        print(f"{total_before} → {total_after} tasks. " + ("in sync." if in_sync else "OUT OF SYNC."))
        return 0 if in_sync else 1
    if args.dry_run:
        print(
            f"{total_before} → {total_after} tasks. Nothing written (--dry-run); "
            "re-run without --dry-run to apply."
        )
        return 0

    if in_sync:
        print(f"{total_after} tasks. Already in sync; file untouched.")
        return 0

    tasks_path.parent.mkdir(parents=True, exist_ok=True)
    tasks_path.write_text(after, encoding="utf-8")
    print(f"{total_before} → {total_after} tasks. Wrote {tasks_path.relative_to(root)}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
