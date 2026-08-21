#!/usr/bin/env python3
"""Measure the planning-authored body of a bmad-dev-auto spec.

Story 7.15's instrument, committed so the verdict's numbers can be re-measured
rather than merely re-asserted. The original lived in a session-scoped .tmp/
directory and was discarded; that was a review finding against a story whose
whole premise is "measured, not estimated".

Body rule (see _bmad/custom/bmad-dev-auto.toml, "SPEC SIZE MEASUREMENT"):
  - cut at whichever comes FIRST of "## Implementation Record" / "## Auto Run Result"
    (both are appended by steps 03/04, after the oversized warning is stamped)
  - drop the CONTENTS, but keep the headers, of "## Spec Change Log" and
    "## Review Triage Log" (filled by step-04, likewise after the fact)
  - a spec with none of those headings is already a pure planning body, which is
    the normal case at stamp time -- spec-template.md emits none of them.

Usage:  uv run --with tiktoken _bmad-output/implementation-artifacts/tools/spec-token-count.py SPEC.md [...]
        python3 _bmad-output/implementation-artifacts/tools/spec-token-count.py SPEC.md   # chars/4 only

Without tiktoken it falls back to chars/4, which tracked o200k_base within 4.3%
across the six specs measured in Story 7.15. The fallback is labelled in the output.
"""

import sys

CUT_AT = ("## Implementation Record", "## Auto Run Result")
DROP_BODY_OF = ("## Spec Change Log", "## Review Triage Log")


def extract_body(text: str) -> str:
    lines = text.splitlines(keepends=True)
    out, skipping = [], False
    for line in lines:
        stripped = line.rstrip()
        if stripped in CUT_AT:
            break
        if stripped in DROP_BODY_OF:
            out.append(line)
            skipping = True
            continue
        if skipping:
            # a new section header ends the drop; anything else is discarded content
            if stripped.startswith("## "):
                skipping = False
            else:
                continue
        out.append(line)
    return "".join(out)


def main(paths):
    try:
        import tiktoken

        enc = tiktoken.get_encoding("o200k_base")
        method = f"o200k_base (tiktoken {tiktoken.__version__})"
        count = lambda s: len(enc.encode(s))
    except ImportError:
        method = "chars/4 FALLBACK -- no tokenizer available, figure is approximate"
        count = lambda s: round(len(s) / 4)

    print(f"method: {method}\n")
    print(f"{'spec':<52}{'body':>8}{'whole':>8}{'inflation':>11}")
    for path in paths:
        text = open(path).read()
        body = extract_body(text)
        b, w = count(body), count(text)
        name = path.rsplit("/", 1)[-1]
        print(f"{name:<52}{b:>8}{w:>8}{w / b:>10.2f}x")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1:])
