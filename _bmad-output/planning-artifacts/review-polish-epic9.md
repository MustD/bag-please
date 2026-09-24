# Editorial polish — Epic 9 text (2026-09-15 pass)

Scope: `prd.md` first `editHistory` entry (2026-09-15), the amended sentences of FR13, FR44, FR56, FR57, FR61 (full text
of each, since the amendment note sits at the end of the whole paragraph), the "User Feedback" section (FR66, FR67),
FR68, FR69, "Epic 9 — User Feedback Pass (Planned)", and the first bullet under "Phase 3 — Growth".
No other text was reviewed or touched. Lenses run: structure, then prose (bmad-review skill).

## Structure findings

Nothing to cut, merge, or move. The scoped passages are requirement/changelog prose, already dense and consistent
with the document's established changelog and FR conventions (compare the 2026-09-05/2026-07-30 entries). No
redundancy, missing scaffolding, or scope violations found within the scoped text.

## Prose findings — applied (6 edits)

1. **FR13** — "with controls to move between pages and the total user count" grammatically mismatched "controls"
   against "the total user count" as if the count were itself a control. Reworded to "with controls to move between
   pages and a display of the total user count."
2. **FR44** — split a heavy `, so` compound sentence into two, and tightened "Store names are trimmed, and names
   differing..." into "Store names are trimmed; names differing...". No meaning change.
3. **FR56** — misplaced "only" ("...configuration, and reviewing user feedback (FR67) only") moved to its correct
   position: "restricted only to user management, application configuration, and reviewing user feedback (FR67)".
4. **FR57** — ambiguous pronoun: "on the home route it simply closes the menu" — antecedent unclear (title link vs.
   Home entry). Resolved to "on the home route the Home entry simply closes the menu."
5. **FR61** — terminology: "the management view" and "the management screen" (two occurrences) standardized to "the
   list management screen", matching the term used everywhere else in FR61/63/68.
6. **FR68** — terminology: "today adding an item means going to list management" → "...going to the list management
   screen", matching the standardized term.

All six are wording/grammar/terminology fixes with no change to FR IDs, requirement scope, numbers, or rulings.
Line wrapping was reflowed to ~120 chars to match the surrounding file after each edit.

## Not applied

- **editHistory (2026-09-15) — "confirmed by md on 2026-09-15"**: the trailing date is redundant with the entry's
  own `date: '2026-09-15'` key. Considered cutting it for concision but left it: it records that the confirmation
  happened same-day as the amendment, which is meaningful audit-trail precision (and would silently go stale if the
  entry were ever hand-edited on a later date without updating this clause). Judgment call, not applied.
- **Pre-existing YAML defect (out of scope)**: the 2026-09-05 `editHistory` entry contains an unescaped apostrophe —
  `Epic 8's closing story` (single, not doubled `''`) — which breaks strict YAML parsing of the frontmatter. This
  sits entirely outside the 2026-09-15 scope for this pass (it's in the prior entry, untouched by Epic 9), so it was
  left alone per the "leave all other text untouched" instruction. Flagging it here since it affects the whole
  document's frontmatter validity — worth a follow-up edit to double that apostrophe.
- No findings from either lens changed meaning, so nothing was withheld for that reason beyond the above two.

## Verified

- The 2026-09-15 `editHistory` entry (my only in-scope YAML content) parses as valid YAML on its own (checked with
  `yaml.safe_load`); all apostrophes inside it are correctly doubled (`''`).
- Re-wrapped lines in FR13, FR44, FR57, FR61, FR68 checked to stay within ~112–120 chars, consistent with
  surrounding paragraphs.
