---
name: sync-zed-mise-tasks
description: 'Sync the Zed editor''s task list (.zed/tasks.json) with the project''s mise tasks (mise.toml), so every `mise run` task is spawnable from Zed''s command palette. Use this whenever mise tasks are added, renamed, or removed, whenever someone edits mise.toml at all, or whenever the two files might have drifted — and also when the user mentions Zed tasks, .zed/tasks.json, "task: spawn", mise tasks, or asks why a task is missing from or stale in Zed''s task picker. Reach for this even if the user only says "I added a mise task" without mentioning Zed, because a new mise task is exactly when Zed''s list goes stale.'
---

# Sync Zed tasks with mise tasks

`mise.toml` is the source of truth for what tasks this project has. `.zed/tasks.json` is a mirror of it, so the same
tasks are spawnable from Zed's command palette (`task: spawn`).

Mirrors rot. Someone adds a mise task and forgets Zed, or renames one and leaves a Zed entry pointing at a command that
no longer exists. `scripts/sync_zed_tasks.py` rebuilds the mirror deterministically, and it is the whole
implementation — read it rather than hand-editing JSON, because hand-editing is how the two files drifted in the first
place.

## Workflow

Run the sync in two steps. The script writes a generated file over a file people hand-tune, so the user gets to see the
change before it lands.

```bash
python3 .claude/skills/sync-zed-mise-tasks/scripts/sync_zed_tasks.py --dry-run
```

This prints a per-task plan (`+ add`, `- remove`, `~ update`, `* keep`, `= unchanged`), any warnings, and a unified
diff. Nothing is written.

Read the plan and relay it. Then judge whether it is safe to apply:

- **Only additions, or removals whose reason is "no `X` task in mise config"** — that is the mirror catching up. Apply
  it.
- **A `- remove` you can't explain**, or a `~ update` that undoes something the user clearly tuned on purpose — stop and
  ask. A removal means someone's task disappears from their palette, and the script cannot know whether the mise task
  was deleted deliberately or the rename is a typo.

Apply by dropping the flag:

```bash
python3 .claude/skills/sync-zed-mise-tasks/scripts/sync_zed_tasks.py
```

Re-running is a no-op when already in sync, so it is safe to run whenever you're unsure.

Both files are committed, so mention them together if you're also making a commit — a
`mise.toml` change with no matching `.zed/tasks.json` change is the drift starting over.

## Where each Zed option comes from

Highest precedence first:

1. **A `# zed:` comment on the task in `mise.toml`** — an explicit, committed declaration.
2. **The task's existing entry in `.zed/tasks.json`** — hand-tuning is preserved, never flattened. This is why the diff
   on an unchanged task should be empty; if it isn't, something is wrong and worth looking at rather than waving
   through.
3. **Defaults, for tasks the mirror has never seen** — `reveal: "always"`, plus
   `allow_concurrent_runs: false` when the task looks like it runs until stopped (a watch flag,
   `docker compose up`, a dev server, or a name like `serve`/`start`).

A hint in `mise.toml` overriding an existing hand-tuned value is reported explicitly as
`(hint in mise.toml)`, so that precedence never bites silently.

### Writing hints in mise.toml

mise **rejects unknown fields** with a hard parse error, so Zed options cannot live in a
`[tasks.x.zed]` table — they go in a comment, which mise ignores and which keeps `mise.toml`
valid against its JSON schema:

```toml
# zed: reveal = "never"
[tasks."fmt"]
description = "Format everything"
run = "ruff format ."
```

The syntax after `# zed:` is TOML key/value pairs, comma-separated. The comment can sit directly above the
`[tasks."name"]` header or inside the task's block — but **not separated from it by a blank line**, since a comment
after a blank line belongs to whatever follows it.

Two forms worth knowing:

```toml
# zed: skip
[tasks."internal-helper"]        # exists in mise, deliberately absent from Zed's palette
run = "..."

# zed: allow_concurrent_runs = true, reveal = "no_focus"
[tasks."ping"]
run = "curl -s localhost:4000/health"
```

`hide = true` on the mise task itself also keeps it out of Zed — a task hidden from
`mise tasks` has no business in the palette either.

Valid Zed fields: `args`, `env`, `cwd`, `use_new_terminal`, `allow_concurrent_runs`, `reveal`
(`always`/`no_focus`/`never`), `reveal_target`, `hide` (`never`/`always`/`on_success`), `shell`,
`show_summary`, `show_command`, `save`, `tags`, `hooks`, `reevaluate_context`. An unrecognized key is passed through
with a warning rather than dropped, so a new Zed release doesn't break the sync.

## What the script will and won't touch

- **Grouping comments come from `mise.toml`.** Its `# --- Section ---` comments become
  `// --- Section ---` in the JSON, in document order. So reword a group heading in
  `mise.toml`, not in the JSON. Heading changes are reported separately from task changes because they're easy to miss
  in a diff.
- **Hand-written Zed tasks survive.** A task whose `command` is not `mise run <something>`
  isn't a mirror, so it's kept and moved under a `// --- Zed-only (not backed by mise) ---`
  section. Only stale *mirrors* get deleted.
- **The file's header comment is preserved** if it already has one.
- **`mise.local.toml` is ignored on purpose** — it's machine-local, and `.zed/tasks.json` is committed. The script warns
  when it sees one.
- **It refuses rather than guesses**: unparseable `mise.toml`, unparseable `.zed/tasks.json`
  (it won't overwrite a file it can't read), or a `mise.toml` with no tasks at all. All exit 2.

## Keeping it from drifting again

`--check` reports drift without writing and exits 1 when out of sync, which is what you want in CI or a pre-commit hook:

```bash
python3 .claude/skills/sync-zed-mise-tasks/scripts/sync_zed_tasks.py --check
```

If the user wants drift caught automatically, this is the hook to wire up — offer it, but don't add it to their config
unless they ask.
