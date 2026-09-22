// Per-run E2E data hygiene (Story 9.2) — the mechanism for Epic 7 action D4.
//
// WHY THIS EXISTS. The suite creates ~120 user rows per full run and, until now,
// removed exactly one of them (the FR15 delete test's). The table therefore grew
// without bound across runs, and the admin panel used to render every row, so
// the create-user dialog's close got slower run after run: at 5497 rows it
// measured 5015 ms against a 5000 ms assertion. Pagination (this same story)
// removes the MECHANISM of that failure; this sweep removes the GROWTH, which is
// owed on its own account — and it also drains the rows earlier runs already
// banked, which merely stopping the growth would not.
//
// WHY A SWEEP AND NOT A DATABASE RESET. The named `db_data` volume is the
// configuration the whole suite depends on and is always kept: no `down -v`, no
// wipe. A sweep also needs no privileged docker step inside `webServer`, and it
// runs once at teardown so it can add no per-test latency.
//
// NO RETRY LOOP — that is the shape Story 7.3 deleted. A failure here is LOGGED
// and swallowed: the sweep is housekeeping, and a run that passed must not be
// reported as failed because a cleanup call did not land. The next run's sweep
// picks up whatever this one missed.
//
// It talks to :2080 directly for the same reason global-setup.ts does — this is
// backend housekeeping, not the browser-facing origin under test — and imports
// from ./support/api, which deliberately pulls in nothing from `@playwright/test`.

import {
  ADMIN,
  deleteFeedbackApi,
  deleteUserApi,
  E2E_USERNAME_MARKER,
  listE2eFeedback,
  listE2eUsers,
  loginApi,
} from './support/api'

async function globalTeardown(): Promise<void> {
  try {
    const token = await loginApi(ADMIN.username, ADMIN.password)
    // Collected in full BEFORE anything is deleted: paging a collection while
    // removing rows from it would skip entries as later pages shift down.
    const users = await listE2eUsers(token)

    let removed = 0
    for (const user of users) {
      try {
        await deleteUserApi(token, user.id)
        removed += 1
      } catch (err) {
        console.warn(`[e2e teardown] could not delete ${user.username}: ${String(err)}`)
      }
    }
    // STDERR, not stdout. Playwright's `json` and `junit` reporters write their
    // report to STDOUT, and a stray `console.log` here lands in the middle of it
    // and makes the report unparseable — measured: `--reporter=json` produced a
    // file starting with this very line. Every message in this module therefore
    // goes to stderr, which reporters leave alone.
    console.error(
      `[e2e teardown] removed ${removed} of ${users.length} users matching "${E2E_USERNAME_MARKER}"`,
    )

    // Story 9.10 — same hygiene for feedback: `sendFeedback`'s tests (Story 9.9)
    // leave rows behind with no cleanup, and the new admin panel is unpaginated
    // by design, so unbounded growth here degrades it the same way the
    // pre-9.2 user table degraded before pagination.
    const feedbackRows = await listE2eFeedback(token)
    let feedbackRemoved = 0
    for (const row of feedbackRows) {
      try {
        await deleteFeedbackApi(token, row.id)
        feedbackRemoved += 1
      } catch (err) {
        console.warn(`[e2e teardown] could not delete feedback ${row.id}: ${String(err)}`)
      }
    }
    console.error(
      `[e2e teardown] removed ${feedbackRemoved} of ${feedbackRows.length} feedback rows matching "${E2E_USERNAME_MARKER}"`,
    )
  } catch (err) {
    // The stack may already be down, or the admin login may have failed. Say so
    // and let the run's own result stand.
    console.warn(`[e2e teardown] sweep skipped: ${String(err)}`)
  }
}

export default globalTeardown
