# Presentation Performance Hot Paths Plan

1. Add failing tests for reference-based history commits and visibility-gated slide previews.
2. Replace history deep serialization with reference equality.
3. Add a memoized, `IntersectionObserver`-gated editable slide thumbnail.
4. Run focused presentation tests, typecheck, and build.
