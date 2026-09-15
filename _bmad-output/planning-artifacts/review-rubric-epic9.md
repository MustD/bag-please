# PRD Quality Review — Epic 9 (User Feedback Pass, 2026-09-15 changes only)

Scope: FR13, FR44, FR56, FR57, FR61 (amended sentences), the new "User Feedback" section (FR66, FR67), FR68, FR69, the
"Epic 9 — User Feedback Pass (Planned)" scoping section, and the
first Phase 3 bullet. Source input: `docs/feedback.md`. This is a solo/hobby-household app —
rigor is calibrated light per the rubric's "Hobby / solo" shape-fit guidance; findings below are
real gaps, not template-completeness nits.

## Overall verdict

This is a tight, well-specified fast-path planning pass — each FR carries a concrete, testable
consequence, amendments are clearly marked and dated, and the editHistory entry documents every
inferred detail as confirmed by md. The two amendments that touch shared surfaces (FR44's
single→multi-store change, FR56's admin-feedback carve-out) leave small but real gaps: the
migration mechanics for the store conversion are underspecified next to FR47's precedent, and the
admin's relationship to the Feedback entry in the account menu is never stated. Nothing here rises
above medium severity for a project at this scale.

## Decision-readiness — adequate

The amendments are stated as amendments with an explicit "Amended 2026-09-15" tag and a one-line
diff of what changed (FR13, FR44, FR56, FR57, FR61), which is good practice — a reader doesn't have
to diff against git history to know what's new. The Epic 9 scoping section names its source
document directly. No findings.

### Findings

(none — dimension is adequate, no findings needed)

## Substance over theater — strong

No boilerplate NFR language or persona theater in this slice. FR66/FR67 carry specific bounds (2000-char cap, "newest
first," "plain text, never interpreted as markup") rather than vague
adjectives. No findings.

## Strategic coherence — adequate

The Phase 3 bullet ("Store mode... builds on multi-store FR44") correctly sequences FR44 as
groundwork rather than the full feature, and FR44's own text calls out the Phase 3 dependency
explicitly ("the groundwork for showing only one store's items while shopping there"). Coherent.

## Done-ness clarity — thin

### Findings

- **medium** FR69's migration completion mechanism is unspecified (§ FR69) — FR47, the precedent
  this migration must not repeat the mistakes of, is explicit about its completion marker ("writes
  a completion record to `app_migrations` and does not re-run"). FR69 only says the store
  conversion "runs once... and does not re-run" with no stated mechanism (reuse `app_migrations`
  with a new key? a per-item marker? a schema-version flag?). Since FR47 already exists and writes
  to `app_migrations`, an implementer has to guess whether FR69 shares that collection/record or
  needs its own — and FR47's hard-fail-if-no-non-admin-users precedent has no FR69 analogue (what
  happens if the conversion runs mid-write, or twice, due to a race with app restart?). *Fix:* add
  one clause to FR69 naming the completion-tracking mechanism, mirroring FR47's phrasing.

- **low** FR44's store-field storage shape change is implied, not stated (§ FR44) — the FR says an
  item "had a store" (singular) before and "keeps it as its only store" after (FR69), which only
  makes sense if the underlying field changes from a scalar to a list. Neither FR44 nor FR69 says
  this out loud (e.g., "the `store` field becomes `stores: [String]`"), leaving the schema-shape
  decision to be inferred by whoever builds it — borderline implementation leakage either way, but
  the PRD should at least be explicit that a field-shape migration, not just a UI change, is in
  scope. *Fix:* add a sentence to FR44 or FR69 naming the field-shape change plainly.

## Scope honesty — adequate

The "Amended" tags double as de-scoping honesty — each amendment states what the previous FR said,
so nothing is silently dropped. No `[ASSUMPTION]` tags appear in this slice, but the editHistory
entry lists every inferred detail confirmed by md in one place, which does the same job at lower
overhead — appropriate for the stakes. No findings.

## Downstream usability / mechanical — thin

### Findings

- **medium** FR66 vs. FR56: the Feedback account-menu entry's behavior for the admin account is
  unstated (§ FR66, FR56) — FR66 says the Feedback entry is on "any authenticated screen" (which
  includes the admin's screens, since FR12 shows the authenticated user's name in the nav "on all
  screens" for every account including admin), but FR56 separately states the admin "does not send
  feedback." The PRD never says whether the menu entry is hidden for the admin, disabled, or simply
  present-but-would-error if clicked — three different, all-plausible implementations that testers
  and the frontend builder will resolve differently without a ruling. *Fix:* add one clause to
  FR66 or FR56: "the Feedback entry does not appear in the admin's account menu" (or equivalent).

- **low** FR30 is not amended alongside FR56/FR67 (§ FR30, FR56, FR67) — FR30 ("Authenticated admin
  users can access the user management interface") is the FR that has historically gated admin-area
  routing, and FR67 adds a second admin-area surface (feedback review) that FR30's singular "the
  user management interface" doesn't literally cover. This gap predates Epic 9 (the config screen
  from FR20 has the same unstated-routing issue already), so it isn't a new defect Epic 9
  introduced, but Epic 9 is the FR that makes it visible again — the same pattern that bit this
  project once already (see the NFR17/NFR18 editHistory entry on cross-document omission). *Fix:*
  worth a one-line note in FR30 or FR67 that the admin area covers user management, config, and
  feedback review as one routable surface, next time FR30 is touched.

## Shape fit — strong

Hobby/solo calibration is respected: no user-journey padding was added for a two-actor feature (regular user, admin),
FR66/FR67 read as a capability pair rather than an over-formalized flow, and
the rigor matches the stakes. No findings.

## Mechanical notes

- Terminology drift, not introduced by Epic 9 but reinforced by it: FR68 calls the add-item surface
  a "dialog" ("It opens the same add-item dialog the list management screen uses"), consistent with
  FR44's pre-existing "add-item and edit-item dialogs" phrasing, while FR51 (Navigation & UX,
  unamended) mandates "bottom sheet overlays" (`BPSheet`) for all item creation/editing. This is a
  pre-existing glossary inconsistency (dialog vs. sheet) that FR68 propagates rather than resolves —
  low priority, but worth folding into a future glossary pass rather than left to compound further.
- FR61's amendment ("selections apply as they are toggled; confirming only closes and there is no
  cancel-and-revert") is internally consistent and testable as written, but the control is still
  labeled "confirm" for an action that does not confirm-vs-cancel anything — it is functionally a
  close button. This is intentional per the amendment text and not a defect, but flagging it because
  the label choice invites an implementer to build an actual apply/cancel semantics by reflex; the
  FR text already forecloses that, so no fix needed beyond keeping the wording as-is during story
  writing.
- No ID continuity issues in this slice: FR66–FR69 are contiguous and non-conflicting with existing
  IDs; all cross-references (FR60, FR52, FR17, FR44↔FR69, FR61↔epics.md) resolve to FRs that exist
  in the document.
