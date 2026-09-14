#!/usr/bin/env bash
# Run the backend tests and print just the per-test results plus a summary.
#
# Gradle's own test logging (configured in bp_back/build.gradle.kts) already emits one
# PASSED/FAILED/SKIPPED line per test; this strips the blank line it pads each event with
# and adds the totals Gradle only prints when the build fails. Any extra args are passed
# through to Gradle, e.g. `mise run back:test -- --tests "*AuthApiTest*"`.
set -uo pipefail

results_dir="bp_back/build/test-results/test"
rm -rf "$results_dir"

# The second grep drops one known-benign block: on JDK 25 Gradle's launcher JVM warns
# that jansi calls a restricted native method. It is not reachable via GRADLE_OPTS or
# org.gradle.jvmargs, so it is filtered here by its exact wording rather than hidden wholesale.
gradle :bp_back:test -q --console=plain "$@" 2>&1 \
    | grep -v '^[[:space:]]*$' \
    | grep -vE '^WARNING: (A restricted method|java\.lang\.System::load has been called by org\.fusesource\.jansi|Use --enable-native-access|Restricted methods will be blocked)'
status=${PIPESTATUS[0]}

if [ -d "$results_dir" ]; then
    awk '
        match($0, /<testsuite [^>]*>/) {
            s = substr($0, RSTART, RLENGTH)
            if (match(s, /tests="[0-9]+"/))    t += substr(s, RSTART + 7, RLENGTH - 8)
            if (match(s, /skipped="[0-9]+"/))  s2 += substr(s, RSTART + 9, RLENGTH - 10)
            if (match(s, /failures="[0-9]+"/)) f += substr(s, RSTART + 10, RLENGTH - 11)
            if (match(s, /errors="[0-9]+"/))   e += substr(s, RSTART + 8, RLENGTH - 9)
        }
        END { printf "\n%d tests: %d passed, %d failed, %d skipped\n", t, t - f - e - s2, f + e, s2 }
    ' "$results_dir"/*.xml
fi

exit "$status"
