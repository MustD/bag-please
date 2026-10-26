---
status: done
---

# Story 11.11: Both users move to the new home

## Auto Run Result

Status: done

- Release 1.0.0 prepared in e314b42: version bumped, `routing/edge-proxy.md` describes the production domain and upstream.
- Gates before the release: `gradle :bp_back:test` 239 tests, 0 failures; `npm run generate` left no diff; E2E on the production stack 283 passed, 0 failed, 29 skipped on the second run (the first run had failures that did not recur).
- md ran the cutover: `infra:apply`, `db:bootstrap`, `db:import`, `deploy` (1.0.0 up, data in place), edge repoint.
- Close-out: `migration-export/` moved out of the working tree to an off-repo directory in md's home (mode 700). `git ls-files -ci --exclude-standard` lists nothing. The old deployment is retired by md.
