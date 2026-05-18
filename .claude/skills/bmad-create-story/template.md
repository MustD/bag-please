# Story {{epic_num}}.{{story_num}}: {{story_title}}

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a {{role}},
I want {{action}},
so that {{benefit}}.

## Acceptance Criteria

1. [Add acceptance criteria from epics/PRD]

## Tasks / Subtasks

- [ ] Task 1 (AC: #)
  - [ ] Subtask 1.1
- [ ] Task 2 (AC: #)
  - [ ] Subtask 2.1

## Dev Notes

- Relevant architecture patterns and constraints
- Source tree components to touch
- Testing standards summary

### Project Structure Notes

- Alignment with unified project structure (paths, modules, naming)
- Detected conflicts or variances (with rationale)

### Unhappy-Path & Concurrency Checklist

Before marking this story complete, the dev agent must verify and explicitly check each item:

- [ ] **Mutation errors surface to the user** — mutations that fail (GQL errors or network errors) display a visible
  error message; the UI does not silently reset or close
- [ ] **Dialog does not close on error** — confirm/action dialogs stay open when their action fails; only close on
  explicit success
- [ ] **Cancel remains interactive during in-flight requests** — the Cancel/close button is never disabled while a
  mutation is loading; only the confirm/submit button disables
- [ ] **Client-side input validation** — empty/blank required fields are rejected client-side with a field-level error
  before the request is sent
- [ ] **Concurrent write safety** — if a handler can be called concurrently (double-click, parallel requests), there is
  a guard (loading flag, MongoDB unique index, or mutex) that prevents duplicate writes
- [ ] **Loading state prevents double-submit** — buttons that trigger async actions are disabled while the action is in
  flight

### References

- Cite all technical details with source paths and sections, e.g. [Source: docs/<file>.md#Section]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
