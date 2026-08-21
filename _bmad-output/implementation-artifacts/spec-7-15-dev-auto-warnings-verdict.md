---
title: 'Story 7.15 — Give the dev-auto Warnings a Measured Verdict'
type: 'chore'
created: '2026-08-21'
baseline_revision: 'f3111c1'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-7-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/deferred-work.md'
warnings: [oversized]
---

<!-- oversized: 4291 tokens (o200k_base), 2.7x the 1600 ceiling — measured with the very instrument this story
     builds, on its first use. Recorded rather than trimmed: the bulk is the Code Map's line-level evidence
     index and four Design Notes that each pre-empt a wrong turn (editing a DO-NOT-EDIT file, measuring whole
     files, faking a Claude tokenizer, closing on the flattering half of the evidence). Cutting them to hit a
     budget this story exists to adjudicate would be the ruling made by omission. This spec is a sixth data
     point, and the only one whose count is exact rather than reconstructed. -->

<intent-contract>

## Intent

**Problem:** `bmad-dev-auto` has stamped `warnings: [oversized]` on five consecutive specs (5.5, 5.6, 5.7, 6.1, 6.2)
and `multiple-goals` on 6.1, against a budget (`spec-template.md:12`, 900–1600 tokens) nobody has ever measured
against. Neither warning blocks anything, so the signal has been carried unread across three epics and is now on its
fourth slip (`deferred-work.md:121-125`, Epic 6 retro action B8). AR-E7-13 requires a verdict, not a fifth slip.

**Approach:** Measure → correlate → encode, in that order. Count the tokens of the five specs' **planning-authored
body only** with a reproducible instrument, put those counts beside each spec's already-recorded review-triage counts,
state honestly whether five samples support a conclusion, then encode the verdict in a durable artifact — the
determining fact being *which* artifact can actually change agent behaviour, which must be established by measuring
the customization surface rather than assumed from AR-E7-13's wording.

## Boundaries & Constraints

**Always:** Measure the **planning-authored body** of each spec, not the file as it stands — steps 03/04 append
`## Implementation Record` and `## Auto Run Result` and fill the two log sections *after* the warning was emitted, so
the current file size is not what the threshold saw. State the tokenizer used by name and version; no tokenizer here
is Claude's, so report the instrument as a proxy and say so. Report counts as measurements with their method, never as
the estimates AR-E7-13 supplies (5.5 ≈ 2×, 6.2 ≈ 2×, 6.1 ≈ 4×) — those are what this story replaces. Weigh the
`multiple-goals` flag on 6.1 as a **correct** warning and say why that is different evidence from a noisy one. Any
verdict artifact must be committed and outside this epic's retrospective.

**Block If:** the only defensible verdict requires editing `{skill-root}/customize.toml` or any other
`.claude/skills/bmad-dev-auto/` file — that file states `DO NOT EDIT -- overwritten on every update`, and forking the
skill is a decision for `md`, not for an unattended run. Also block if the measurement shows the five specs are
*inside* the 900–1600 budget, since that would mean the warning is fabricated rather than mis-thresholded and the
question changes shape.

**Never:** Do not change any `bp_back/`, `bp_front/` or `routing/` source. Do not edit the five historical specs'
frontmatter or bodies — they are the evidence. Do not run any build, lint, test or E2E gate; nothing this story
touches is on a code path any gate covers. Do not claim a statistical result from n=5. Do not write the verdict only
into `epic-7-retro-*.md`. Do not add a config key that nothing reads and call the threshold "raised".

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Body extraction | A spec whose sections run `<intent-contract>` … `## Verification` … `## Auto Run Result` | Body = start of file through the last line before `## Auto Run Result`, with `## Review Triage Log` and `## Spec Change Log` **content** excluded (headers kept) | If a spec lacks `## Auto Run Result`, extract to EOF and record the deviation |
| Tokenizer available | `uv run --with tiktoken` resolves | `o200k_base` counts recorded per spec, plus the chars/4 cross-check | If the network or `uv` fails, fall back to chars/4 alone and label every count as an approximation |
| Two instruments disagree | tiktoken count vs chars/4 differ by >15% | Both reported side by side; the tiktoken figure is the headline | Never silently pick the flattering one |
| Verdict encoding | `_bmad/custom/bmad-dev-auto.toml` absent; base `[workflow]` has only 4 keys, none a threshold | Whatever lands there must be a key the workflow **actually reads** — verified by re-running the resolver — or the encoding goes to `project-context.md` instead | An unread key is a failed encoding, not a completed AC4 |

</intent-contract>

## Code Map

**Evidence, read-only — must not be edited:**
- `_bmad-output/implementation-artifacts/spec-5-5-lists-management.md` — `warnings: [oversized]`; planning body ends
  line 128 (`## Auto Run Result` at 129); triage log at 96–108 (`patch: 3`, `defer: 1`, `reject: 10`).
- `_bmad-output/implementation-artifacts/spec-5-6-list-view-shopping-realtime.md` — `[oversized]`; body ends 134;
  triage at 99–113.
- `_bmad-output/implementation-artifacts/spec-5-7-sharing-and-membership.md` — `[oversized]`; body ends 137;
  triage at 99–115.
- `_bmad-output/implementation-artifacts/spec-6-1-edit-item-name-category-store.md` — `[multiple-goals, oversized]`;
  body ends 343; triage at 199–253 (`patch: 9` (0/5/4), `defer: 2` (0/2/0), `reject: 11` (0/0/11)).
- `_bmad-output/implementation-artifacts/spec-6-2-back-to-home-and-lists-navigation.md` — `[oversized]`; body ends
  200; triage at 127–162.
- `_bmad-output/implementation-artifacts/bmad-dev-auto-result-epic-6.md` — §3 is the pre-Epic-6 `multiple-goals`
  report that was ignored; its superseding banner already calls it "prescient and remains open". AC3's evidence.
- `_bmad-output/planning-artifacts/epics.md:592-615` — AR-E7-13, including the estimates this story replaces.
- `.claude/skills/bmad-dev-auto/spec-template.md:12` — the 900–1600 budget, an HTML comment, no tokenizer named.
- `.claude/skills/bmad-dev-auto/step-02-plan.md` instruction 6 — `If {spec_file} exceeds 1600 tokens, add oversized`.
  The threshold is **hardcoded here**, not read from config.
- `.claude/skills/bmad-dev-auto/step-01-clarify-and-route.md` instruction 4 — `multiple-goals`, "Do not split or block".
- `.claude/skills/bmad-dev-auto/customize.toml` — the whole override surface: `[workflow]` with exactly
  `activation_steps_prepend`, `activation_steps_append`, `persistent_facts`, `on_complete`. **No threshold key
  exists.** Header says `DO NOT EDIT`.
- `_bmad/scripts/resolve_customization.py:24-35` — merge rules: scalars override, tables deep-merge, **all other
  arrays append**, no removal mechanism, "purely structural — no field-name special-casing".

**Files this story may change:**
- `_bmad/custom/bmad-dev-auto.toml` — **new**, if the verdict is encodable there. Note `_bmad/custom/.gitignore` is
  `*.user.toml`, so a non-`.user` file here **is committed**, which AC4 requires.
- `_bmad-output/project-context.md` — a spec-size convention, if that is where the verdict belongs.
- `_bmad-output/implementation-artifacts/deferred-work.md:121-125` — close the entry (AC5).
- `_bmad-output/implementation-artifacts/sprint-status.yaml:125` (`7-15-dev-auto-warnings-verdict: backlog`) and
  `last_updated:38` — reconcile at close.
- This spec file — the measurements and the verdict live in its Implementation Record.

## Tasks & Acceptance

**Execution:**
- [x] `_bmad-output/implementation-artifacts/*.md` (the five specs) -- extract each planning body per the I/O matrix
  rule into `.tmp/03634b77-6886-48cb-9dd7-9e30cadafcb8/`, and record byte/word/line counts for each -- the current file is not what the
  threshold saw, and this is the only defensible denominator.
- [x] `.tmp/03634b77-6886-48cb-9dd7-9e30cadafcb8/` -- count tokens of each extracted body with `uv run --with tiktoken` (`o200k_base`) and
  again as `chars/4`; record both, plus the whole-file count for contrast -- two instruments, disagreement stated,
  and the whole-file/body gap is itself a finding about what the warning measures.
- [x] this spec's Implementation Record -- tabulate the five bodies against the 900–1600 budget, replacing AR-E7-13's
  ≈2×/≈2×/≈4× estimates with the measured multiples -- AC1.
- [x] this spec's Implementation Record -- put each spec's triage counts (`patch`/`defer`/`reject`, with severity
  splits where recorded) beside its size, state whether size tracks findings, name the 6.1 data point, and state
  plainly that n=5 with no controls supports a direction at best, not a conclusion -- AC2.
- [x] this spec's Implementation Record -- record the `multiple-goals` chain: Epic 6 planning review created the
  two-goal scope, `bmad-dev-auto-result-epic-6.md` §3 reported it **before** Epic 6 ran, it was ignored, 6.1 then
  produced the epic's largest finding count including six assertions that could not fail -- AC3.
- [x] `_bmad/custom/bmad-dev-auto.toml` -- FIRST, establish whether a toml encoding can work at all: write a
  candidate file, run `python3 _bmad/scripts/resolve_customization.py --skill .claude/skills/bmad-dev-auto --key
  workflow`, confirm the value appears in the resolved output, and grep the step files + SKILL.md for a consumer of
  that key -- an unread key is a failed encoding, and this answers which artifact AC4 gets.
- [x] `_bmad/custom/bmad-dev-auto.toml` and/or `_bmad-output/project-context.md` -- write the verdict into whichever
  artifact the previous task proved can carry it, keeping or deleting the candidate file accordingly -- AC4.
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` -- strike through the entry at :121-125 with the
  verdict, the date, and the artifact that now holds it, matching the `~~…~~ **CLOSED …**` form the file already uses
  -- AC5.
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` -- set `7-15-dev-auto-warnings-verdict: done` with a
  one-line factual summary, and refresh `last_updated` -- standing close convention.
- [x] `git commit` -- one commit, `_bmad-output/` and `_bmad/custom/` paths only -- the epic forbids bundling, and no
  source tree is touched.

**Acceptance Criteria:**
- Given the five flagged specs, when their planning bodies are tokenized, then each spec's count, its multiple of the
  1600 ceiling, the tokenizer name, and the body-extraction rule are all recorded, and AR-E7-13's three estimates are
  each replaced by a measured figure.
- Given the measurements, when they are placed beside the existing triage counts, then the record states whether size
  predicts finding count across the five, names 6.1 as the largest spec / only `multiple-goals` flag / highest finding
  count, and explicitly states that five samples do not establish causation.
- Given `bmad-dev-auto-result-epic-6.md` §3, when the verdict is formed, then the record states that the flag was
  correct, that it was raised before Epic 6 ran, that it was ignored, and that a correct warning is weighed
  differently from noise.
- Given the verdict, when it is encoded, then a committed file outside `epic-7-retro-*` carries it; if that file is
  `_bmad/custom/bmad-dev-auto.toml` then the resolver output is shown carrying the value and the consuming step file
  is named; if no toml key is consumable, then `project-context.md` carries a spec-size convention instead and the
  record says why the toml route was rejected.
- Given `deferred-work.md:121-125`, when the story closes, then that entry reads as closed, dated, carrying the
  verdict and naming the artifact — and `grep -n "oversized" deferred-work.md` shows no surviving open form.

## Spec Change Log

## Review Triage Log

## Design Notes

### 1 — The threshold is not in the toml, and AR-E7-13's "raise it in `_bmad/custom/bmad-dev-auto.toml`" cannot be taken literally

Measured on a clean tree at `f3111c1`: the entire customization surface for this skill is `[workflow]` with four keys
(`activation_steps_prepend`, `activation_steps_append`, `persistent_facts`, `on_complete`). The 1600 number lives in
`step-02-plan.md` instruction 6 as prose, and the 900–1600 budget in `spec-template.md:12` as an HTML comment. Neither
is read from config. So `spec_token_budget = 4000` in the override file would resolve, merge cleanly, and change
nothing — a fifth slip wearing a config file's clothes.

There is exactly one mechanism in that surface that reaches the agent which emits the warning: `persistent_facts` is
an array, arrays **append** under the resolver's structural merge, and SKILL.md activation step 3 loads every entry as
"foundational context you carry for the rest of the workflow run" — before step-01, and so before step-02 decides
whether to stamp `oversized`. A literal (non-`file:`) entry there is therefore read on every run, by the right agent,
at the right time. That is the candidate to test. Whether a fact stated to an agent is a durable enough encoding, or
whether a `project-context.md` convention is the honest home, is what the implementation decides — and it must decide
it by observing the resolver, not by reasoning about it.

### 2 — Measure the body, not the file, or the story measures the wrong thing twice over

The warning is written by `step-02-plan.md` about the spec **as planned**. Everything under `## Auto Run Result`, the
Implementation Record, and the filled-in triage/change logs are appended by steps 03 and 04, after the fact. Story
6.1's file is 419 lines; its planning body ends at 343. Story 5.5's file is ~170; its body ends at 128. Measuring
whole files would inflate every count non-uniformly and would make the "how far over budget" number meaningless.

The planning-time snapshots are **not recoverable from git**: all five specs entered history in the single squashed
commit `d4d94fa` ("Redesign and personal lists (#30)"), already complete. Section-boundary extraction is the only
available reconstruction, and its imprecision — Design Notes are planning-authored, the two log *headers* are template
scaffolding, the *contents* are not — must be stated as a limit on the measurement rather than glossed.

### 3 — There is no Claude tokenizer on this host, and pretending otherwise would be the exact failure this story exists to correct

No `ANTHROPIC_API_KEY` is set and neither `tiktoken` nor `anthropic` is importable from the system Python; `uv` is on
PATH and the network resolves, so `uv run --with tiktoken` gives a reproducible OpenAI `o200k_base` count. That is a
proxy, not the tokenizer that produced the warnings — and note that the warnings themselves were produced by an agent
*estimating*, since the workflow names no tokenizer at all. That gap is itself a finding worth recording: a threshold
stated in tokens, with no tokenizer specified and no mechanism to measure, cannot be complied with precisely by
anyone. Report the proxy honestly, cross-check with chars/4, and let a 2×-vs-4× conclusion rest on the ratio rather
than on any single absolute number.

### 4 — "The threshold is wrong for this codebase" is a real finding, and the counter-evidence is already on the table

AR-E7-13 explicitly accepts a "we looked and the threshold is wrong" close, and the plausible mechanism is that every
bag-please spec must carry a large body of standing convention (`project-context.md` alone runs 1048 lines). But 6.1
is a genuine counterweight: it was the biggest, the only `multiple-goals`, and the highest-finding story of Epic 6 —
including six assertions that could not fail for the reason they were written. The verdict must survive both facts
rather than pick the one that closes faster, and a mixed verdict (the size threshold is mis-calibrated **and**
`multiple-goals` earns its keep) is a legitimate outcome, not a hedge.

## Verification

**Commands:**
- `wc -c -w -l .tmp/03634b77-6886-48cb-9dd7-9e30cadafcb8/*.body.md` — expected: five files, each non-empty and shorter than its source spec.
- `uv run --with tiktoken python3 -c '…o200k_base…'` — expected: five integer counts printed; a non-zero exit means
  fall back to chars/4 and label accordingly.
- `python3 _bmad/scripts/resolve_customization.py --skill .claude/skills/bmad-dev-auto --key workflow` — expected:
  exit 0, and if `_bmad/custom/bmad-dev-auto.toml` was written, the new value visible in the JSON output.
- `grep -n "oversized" _bmad-output/implementation-artifacts/deferred-work.md` — expected: the entry appears only in
  struck-through/closed form.
- `git status --porcelain` — expected: only `_bmad-output/` and `_bmad/custom/` paths; **no** `bp_front/`, `bp_back/`
  or `routing/` path may appear.
- `git show --stat HEAD` after the commit — expected: the same restricted path set, one commit.

**Manual checks (if no CLI):**
- The step file that consumes whichever `[workflow]` key the verdict lands in is named by file and instruction number
  in the Implementation Record; if none consumes it, the toml route was rejected and `project-context.md` carries the
  verdict instead.
- `_bmad-output/project-context.md`'s `rule_count` is adjusted with its arithmetic stated, per this file's own
  convention, if and only if a directive was actually added there.

## Implementation Record

**Baseline:** `f3111c1` (`epic7-maintenance`). Documentation/measurement story — no application source touched, and no
build, lint, test or E2E gate run, per the spec's Never clause.

### Block-If check (both conditions evaluated before any work)

- *"the only defensible verdict requires editing `{skill-root}/customize.toml` or any other
  `.claude/skills/bmad-dev-auto/` file"* — **not triggered.** A consumable override was proved to exist in
  `_bmad/custom/` (see AC4 below). No file under `.claude/skills/` was read-modified; all were read only.
- *"the measurement shows the five specs are inside the 900–1600 budget"* — **not triggered.** All five bodies measure
  between 2726 and 5959 tokens, i.e. 1.70× to 3.72× the 1600 ceiling. The warning is mis-thresholded, not fabricated.

### The extraction rule actually used

`.tmp/…/extract.py`, applied per the I/O matrix: **body = line 1 through the last line before `## Auto Run Result`,
with the *contents* of `## Spec Change Log` and `## Review Triage Log` removed while their headers are kept.** All
five specs contain `## Auto Run Result`, so no deviation branch was taken. The extracted bodies match the Code Map's
predicted end lines exactly (5.5→128, 5.6→134, 5.7→137, 6.1→343, 6.2→200).

**Its imprecision, stated rather than glossed** (per Design Note 2): planning-time snapshots are *not* recoverable —
all five specs entered history in the single squashed commit `d4d94fa`, already complete — so this is a
reconstruction, not a replay. The reconstruction is imperfect in two known directions: (a) `## Design Notes` is
planning-authored and correctly retained, but on 6.1 and 6.2 some Design Notes were *extended* during the review loop
and those additions cannot be separated out, so those two counts are biased **high**; (b) the two log headers are
template scaffolding retained as ~4 tokens each, a negligible bias high. No correction was applied for either; the
counts are reported as an upper bound on the planning body.

### The instrument, and what it is not

`tiktoken 0.14.0`, encoding **`o200k_base`**, via `uv run --with tiktoken`. Cross-checked against `chars/4`.

**This is a proxy, not Claude's tokenizer.** No `ANTHROPIC_API_KEY` is set on this host and neither `tiktoken` nor
`anthropic` is importable from the system Python; there is no Claude tokenizer available here, and nothing in this
record should be read as one. Worse — and this is a finding in its own right — the warnings being adjudicated were
*themselves* produced by an agent estimating, because `step-02-plan.md` instruction 6 states a threshold in "tokens"
and names **no tokenizer at all**. A token threshold with no named tokenizer and no measuring mechanism cannot be
complied with precisely by anyone, which is a defect in the check independent of where its number is set.

### AC1 — measurement (replacing AR-E7-13's estimates)

| Spec | Body tokens (`o200k_base`) | `chars/4` cross-check | Δ | Whole file (contrast) | file/body | × the 1600 ceiling | AR-E7-13 estimate |
|------|---------------------------:|----------------------:|---:|----------------------:|----------:|-------------------:|-------------------|
| 6.2 back-to-home & lists nav | **2726** | 2610 | −4.3% | 4507 | 1.65× | **1.70×** | ≈3200 (~2×) — **over** by 17% |
| 5.5 lists management         | **3085** | 3016 | −2.2% | 4623 | 1.50× | **1.93×** | ≈3000 (~2×) — accurate |
| 5.6 list view / realtime     | **4468** | 4334 | −3.0% | 5917 | 1.32× | **2.79×** | none given |
| 5.7 sharing & membership     | **4832** | 4754 | −1.6% | 6357 | 1.32× | **3.02×** | none given |
| 6.1 edit item name/cat/store | **5959** | 5739 | −3.7% | 8572 | 1.44× | **3.72×** | ≈6000 (~4×) — accurate |
| **7.15 (this spec, exact)**  | **4530** | 4403 | −2.8% | 4530 | 1.00× | **2.83×** | — |

- **The two instruments agree.** Every `chars/4` figure is within 4.3% of its tiktoken figure — far inside the spec's
  15% disagreement trigger. The tiktoken figure is the headline throughout; neither was cherry-picked.
- **The whole-file/body gap is itself a finding.** Whole files run 1.32×–1.65× their planning bodies, and *the
  inflation is not uniform* — 6.2 inflates most (1.65×) while 5.6 and 5.7 inflate least (1.32×). Anyone re-measuring
  these specs as they stand today would get numbers that are wrong by different amounts per spec, which is why the
  extraction rule is part of the verdict and is written into the encoding artifact.
- **The sixth data point is exact.** This spec was flagged `oversized` by the same workflow, at planning time, before
  any Implementation Record existed — so its whole-file count *is* its body count, with no reconstruction. One
  reconciliation note in the interest of not overclaiming: the frontmatter comment records **4291** tokens from the
  planning pass, but the file measures **4530** at implementation start. Removing the self-describing `oversized`
  comment block (146 tokens, added after that count) leaves 4384 — still 93 tokens above 4291. The file is untracked,
  so the intermediate draft is unrecoverable and the residual cannot be explained. **4530 is the figure of record**;
  4291 is superseded and, notably, the direction of the error is *understatement*.
- **Verdict on AC1's substance:** the flag has fired on **6 of 6** dev-auto specs ever written in this repo, and all
  six were accepted as written without a single trim. A check with a 100% fire rate and a 0% action rate transmits no
  information.

### AC2 — correlation: does size predict findings?

Triage counts as recorded in each spec's own `## Review Triage Log` (read, not assumed; each spec had exactly one
review pass):

| Spec | Body tokens | patch (h/m/l) | defer (h/m/l) | reject | **total findings** | **actionable** (patch+defer) | medium-or-higher |
|------|------------:|---------------|---------------|-------:|-------------------:|-----------------------------:|-----------------:|
| 6.2  | 2726 | 8 (0/5/3) | 4 (0/2/2) | 11 (0/0/11) | **23** | **12** | 7 |
| 5.5  | 3085 | 3 (0/1/2) | 1 (—)     | 10 | **14** | **4** | 1 |
| 5.6  | 4468 | 4 (0/3/1) | 0         | 12 | **16** | **4** | 3 |
| 5.7  | 4832 | 6 (0/0/6) | 1 (—)     | 10 | **17** | **7** | 0 |
| 6.1  | 5959 | 9 (0/5/4) | 2 (0/2/0) | 11 (0/0/11) | **22** | **11** | 7 |

`intent_gap: 0` and `bad_spec: 0` on all five. Severity splits are recorded on 6.1 and 6.2 only; 5.5/5.6/5.7 record
severity for `patch` but not for `defer`/`reject`, so the medium-or-higher column is a floor for those three.

**Rank correlation between body size and findings, across the five:**

| Against | Spearman ρ | Pearson r |
|---------|-----------:|----------:|
| total findings | **+0.000** | +0.142 |
| actionable (patch + defer) | **−0.051** | +0.108 |
| medium-or-higher severity | **−0.103** | +0.082 |

**Size does not predict finding count. The relationship is flat, and the sign is inconsistent between measures.**

The reason is a single spec, and naming it matters more than the coefficient: **6.2 is the *smallest* spec of the five
(2726 tokens, the only one under 2× the ceiling) and produced the *most* findings (23 total, 12 actionable).** Remove
6.2 and the remaining four are perfectly monotone (ρ = +1.000 against total findings, +0.949 against actionable) —
which is exactly why removing it would be dishonest. One of five samples inverting a relationship is not an outlier to
be discarded at n=5; it is the finding.

**A correction to AR-E7-13, on its own evidence.** The planning text asserts that 6.1 "produced the most review
findings — including six assertions that could not fail." The records do not support that. 6.1 produced 22 findings
(11 actionable); **6.2 produced 23 (12 actionable)**. And the "assertions that could not fail" table in
`epic-6-retro-2026-07-29.md:149-157` attributes **five of its seven rows to 6.2** and only two to 6.1 — so the epic's
dominant defect class belongs mostly to the *smallest* spec, not the largest. (The retro's own prose says "6 of the 17
review patches" while its table lists 7 rows; that internal inconsistency is left as found — it is evidence, not this
story's to edit.) 6.1 remains correctly described as the largest spec and the only `multiple-goals` flag; it is not
the highest-finding story.

**Does n=5 support a conclusion?** No, and this record does not claim one. Five specs, no controls, no randomisation,
one reviewer process, review depth confounded with story type (6.1 and 6.2 were reviewed under a stricter Epic 6
regime than 5.5–5.7), and finding counts that are themselves a function of reviewer attention rather than a ground
truth. What n=5 *can* do is refute a hypothesis that predicted a strong effect: "bigger specs cause more review
findings" predicts a clear positive rank correlation, and the measurement returns ρ ≈ 0 with the smallest spec at the
top. That is enough to remove the evidential basis for the current threshold. It is **not** enough to establish the
converse ("small specs are worse"), and no such claim is made or encoded.

### AC3 — the `multiple-goals` chain

1. **The two-goal scope came from the Epic 6 planning review, not from the implementer.** `spec-6-1-…:25-28` scopes
   the story as "Add an `EditItemDialog` … (name, category, store), **and** a shared store field with suggestions used
   by both the add and edit dialogs" — the FR40 edit verb and the FR44 store write path, each independently shippable.
   The tool therefore detected scope creep that the review process itself had introduced.
2. **It was reported *before* Epic 6 ran.** `bmad-dev-auto-result-epic-6.md` §3 ("Intent names an epic, not a story")
   states it explicitly: *"That is the `multiple-goals` warning case … Left as-is, this run would have produced one
   oversized two-goal spec, which is also exactly the open retro action item."* That report is dated to the blocked
   run that preceded any Epic 6 implementation.
3. **It was ignored — precisely and partially, which is the interesting part.** §3's operational recommendation (run
   per story, smallest first) *was* followed: 6.2 landed as `5d56e58`, then 6.1 as `62dec3b`. What was not acted on is
   the underlying observation that 6.1's own intent still carried two independently shippable goals. Splitting the
   *invocation* was mistaken for addressing the *scope*, so 6.1 shipped carrying `warnings: [multiple-goals,
   oversized]` and the flag was carried unread into the Epic 6 retro (action B8) and then into three slips of
   `deferred-work.md`. The superseding banner on that report concedes as much: *"prescient and remains open."*
4. **Why a correct warning is weighed differently from a noisy one.** `oversized` fired 6/6 with ρ ≈ 0 against
   outcomes: it has no discriminating power, so recalibrating it costs nothing that was ever being used.
   `multiple-goals` fired 1 time out of 6, on the one story that genuinely had two goals, ahead of the work, and
   nothing has yet fired it falsely. Precision on the available evidence is 1/1. That is a different object entirely,
   and the only responsible action on a flag with no recorded false positive is to make it *harder* to ignore, not
   easier. n=1 is stated as n=1; the asymmetry in the response is justified by the asymmetry in the cost of being
   wrong, not by the sample size.

### AC4 — where the verdict is encoded, and the proof that it is read

**The route was tested before it was used, per Design Note 1.** AR-E7-13's instruction to "raise it in
`_bmad/custom/bmad-dev-auto.toml`" cannot be taken literally: the 1600 is hardcoded prose in
`step-02-plan.md` instruction 6 and the 900–1600 budget is an HTML comment at `spec-template.md:12`; `grep -rn
"token_budget\|spec_token" .claude/skills/bmad-dev-auto/` returns **nothing**, so a `spec_token_budget = 4000` key
would resolve cleanly and change nothing.

The candidate that works, and was verified working:

- **Artifact:** `_bmad/custom/bmad-dev-auto.toml` (new, committed — `_bmad/custom/.gitignore` is `*.user.toml`, so a
  non-`.user` file here is tracked). It is outside `epic-7-retro-*`.
- **Key:** `workflow.persistent_facts`, four literal (non-`file:`) entries.
- **Resolver proof:** `python3 _bmad/scripts/resolve_customization.py --skill .claude/skills/bmad-dev-auto --key
  workflow` exits 0 and prints all four new entries inside `workflow.persistent_facts`, **appended after** the base
  `"file:{project-root}/**/project-context.md"` entry — confirming the structural array-append merge rather than a
  replacement that would have silently dropped the project-context load.
- **The consumer, named by file and instruction:** `.claude/skills/bmad-dev-auto/SKILL.md`, section **"On Activation →
  Step 3: Load Persistent Facts"** (line 76): *"Treat every entry in `{workflow.persistent_facts}` as foundational
  context you carry for the rest of the workflow run … All other entries are facts verbatim."* Activation Step 3 runs
  **before** step-01 and therefore before `step-02-plan.md` instruction 6 decides whether to stamp `oversized`. This
  is the single mechanism in the whole four-key override surface that reaches the deciding agent at the deciding time.

**What is encoded (the verdict, mixed — both halves survive their counter-evidence):**

1. **`oversized` is mis-calibrated for this repository and is superseded here at 6000 tokens.** Grounds: 6/6 fire
   rate, 0/6 action rate, and ρ ≈ 0 against findings. The threshold is set above the largest spec observed (5959) so
   the flag marks a genuine outlier rather than the norm; this is a population calibration, explicitly *not* a quality
   claim, and it is stated to be revisited as the population grows. The mechanism AR-E7-13 proposed — every
   bag-please spec must restate a large body of standing convention, `project-context.md` alone running 1047 lines —
   is recorded as the reason the stock budget does not fit.
2. **The measurement rule travels with the threshold**: measure the planning body, not the file; name the tokenizer
   and encoding. Without this, the new number is as unmeasurable as the old one.
3. **Size is not a quality proxy**, with the ρ figures and the 6.2 inversion, so that no future run trims a spec
   toward a budget expecting fewer findings.
4. **`multiple-goals` is explicitly *not* recalibrated**, and the workflow is instructed to name both goals in its
   terminal result when it carries the flag, so it cannot be carried unread again.

**Why `project-context.md` was not also edited.** It is already loaded by the same mechanism (the base
`persistent_facts` entry is a `file:` glob for `**/project-context.md`), so a directive there would reach the same
agent — but the verdict governs *when bmad-dev-auto stamps a frontmatter warning*, which is skill-scoped behaviour,
not a project coding convention, and AC4's first branch fits it exactly. No directive was added there, and per that
file's own convention `rule_count` is therefore **left untouched**.

### AC5 — ledger

`deferred-work.md`'s entry is struck through and closed in the `~~…~~ **CLOSED …**` form the file already uses,
carrying the date, the verdict, and the artifact. `sprint-status.yaml` sets `7-15-dev-auto-warnings-verdict: done`
with a one-line factual summary and a refreshed `last_updated`.

### What this pass did NOT establish

- **Not a statistical result.** n=5, no controls, no randomisation, review depth confounded with epoch. ρ ≈ 0 removes
  the basis for the old threshold; it does not prove independence.
- **No Claude token count exists anywhere in this record.** Every figure is `o200k_base`, an OpenAI encoding, used as
  a proxy. The true counts that the workflow's agents "measured" against are unknown and were never measured at all.
- **The planning-time bodies were reconstructed, not recovered.** `d4d94fa` squashed all five specs in complete form;
  Design Note extensions made during review loops on 6.1 and 6.2 cannot be separated out, so those two counts are
  upper bounds.
- **6000 is a population calibration, not a validated threshold.** It was chosen to sit above the observed maximum
  because the evidence supports *no* size threshold, not because 6000 is a demonstrated quality boundary. If a future
  spec exceeds it, that will be the first genuine test of the number.
- **The encoding was proved *resolvable and consumed*, not proved *effective*.** The resolver output shows the facts
  reaching activation Step 3; whether an agent instructed by a persistent fact actually declines to stamp `oversized`
  can only be observed on the next dev-auto run. That is the first falsification opportunity for this verdict.
- **`multiple-goals` precision rests on n=1.** One correct fire, no recorded false positive. That justifies not
  weakening it; it does not establish that it is reliable.
- **No claim is made about whether large specs are good.** The record refutes "size predicts findings". It does not
  argue that specs should be long, and it does not license unbounded specs — 6000 is still a ceiling.

### Verification — commands run and their real output

**1. `wc -c -w -l .tmp/…/*.body.md`** — five files, each non-empty and shorter than its source spec. ✅

```
  112  1545 12131  spec-5-5-lists-management.body.md
  117  2313 17465  spec-5-6-list-view-shopping-realtime.body.md
  118  2498 19134  spec-5-7-sharing-and-membership.body.md
  288  3098 23116  spec-6-1-edit-item-name-category-store.body.md
  164  1447 10480  spec-6-2-back-to-home-and-lists-navigation.body.md
  799 10901 82326  total
```

Note the lines-vs-bytes inversion: 6.2 has the *most* lines (164) and the *fewest* bytes (10480), because 6.1/6.2 are
hard-wrapped at ~120 columns while 5.5–5.7 use very long lines. Line counts are not a size proxy; this is why the
budget is stated in tokens.

**2. `uv run --with tiktoken python3 …` (`o200k_base`)** — exit 0, counts printed, no fallback needed. ✅

```
file                                            tok   chars/4   whole
spec-5-5-lists-management                      3085      3016    4623
spec-5-6-list-view-shopping-realtime           4468      4334    5917
spec-5-7-sharing-and-membership                4832      4754    6357
spec-6-1-edit-item-name-category-store         5959      5739    8572
spec-6-2-back-to-home-and-lists-navigation     2726      2610    4507
tiktoken 0.14.0
```

The same script re-run *after* this Implementation Record was appended reports **9176** tokens for this spec's whole
file, against the **4530** its planning body measured — a 2.03× inflation from steps 03/04 alone. That is the
body-vs-file argument demonstrated live on the file making it, and it is why the extraction rule is encoded next to
the threshold rather than left implicit.

**3. `python3 _bmad/scripts/resolve_customization.py --skill .claude/skills/bmad-dev-auto --key workflow`** — exit 0,
and `workflow.persistent_facts` resolves to **5** entries: the base `file:{project-root}/**/project-context.md`
followed by the four new facts, appended, none replaced. ✅

**4. `grep -n "oversized" _bmad-output/implementation-artifacts/deferred-work.md`** — two hits, both inside the single
closed entry (`:121` the struck-through headline, `:127` the verdict text). No surviving open form. ✅

**5. `git status --porcelain`** — only `_bmad-output/` and `_bmad/custom/` paths; **no** `bp_front/`, `bp_back/` or
`routing/` path appears. ✅

```
 M _bmad-output/implementation-artifacts/deferred-work.md
 M _bmad-output/implementation-artifacts/sprint-status.yaml
?? _bmad-output/implementation-artifacts/spec-7-15-dev-auto-warnings-verdict.md
?? _bmad/custom/bmad-dev-auto.toml
```

**6. `git show --stat HEAD`** — recorded in `## Auto Run Result` after the single commit lands; same restricted path
set, four files, one commit.

**Manual checks.** The consuming step file is named above: `.claude/skills/bmad-dev-auto/SKILL.md`, "On Activation →
Step 3: Load Persistent Facts" (line 76), which runs before step-01 and so before `step-02-plan.md` instruction 6.
`_bmad-output/project-context.md` received **no** directive, so its `rule_count` is left at **105** — unchanged, with
no arithmetic to state, per that file's own convention.

## Auto Run Result

Status: **done** — Story 7.15 closed 2026-08-21 on `epic7-maintenance`, baseline `f3111c1`.

One commit (see `git log -1` on `epic7-maintenance`; this section was folded into it by amend, so no sha is quoted here — a quoted sha would necessarily be the pre-amend one), restricted to `_bmad-output/` and `_bmad/custom/` exactly as the story requires:

```
 .../implementation-artifacts/deferred-work.md              |  21 +-
 .../spec-7-15-dev-auto-warnings-verdict.md                 | 493 +++++++++++++++
 .../implementation-artifacts/sprint-status.yaml            |   4 +-
 _bmad/custom/bmad-dev-auto.toml                            |  20 +
 4 files changed, 531 insertions(+), 7 deletions(-)
```

No `bp_front/`, `bp_back/` or `routing/` path appears; no build, lint, test or E2E gate was run, and none was
applicable. Neither Block-If condition triggered. Nothing under `.claude/skills/` was modified — all of it was read
as evidence only.

**Verdict, in one line:** `oversized` is mis-calibrated for this repository (6/6 fire rate, 0/6 action rate, Spearman
ρ ≈ 0 against review findings, and the smallest spec produced the most) and is superseded at 6000 tokens;
`multiple-goals` earned its keep (1/1 correct, raised before Epic 6 ran, ignored) and is strengthened rather than
relaxed. Both are encoded in `_bmad/custom/bmad-dev-auto.toml` as `workflow.persistent_facts`, proved to resolve and
proved to have a consumer, and the four-slip ledger entry is closed.
