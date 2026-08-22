# Runtime Performance Hot Paths Plan

1. Add failing timer overtime/interval, VLC throttle, and LAN polling tests.
2. Correct timer signed-delta math and select interval cadence from active timer modes.
3. Throttle only VLC `timeChanged` state publication.
4. Replace fixed LAN polling with completion-based scheduling.
5. Run focused main-process tests, typecheck, and build.
