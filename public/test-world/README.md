# test-world — the frozen test content

`data/` holds a small, frozen content set (3 flexymon, the test maps in `public/maps/test/`, a two-boss story on the
`test` map) in the same format as
`public/data/`. The real game never loads it; dev and E2E builds do with `?world=test` or
`localStorage['flexymon.e2e.world'] = 'test'` (`src/data/world.ts`). The unit tests' fixture and most browser tests
depend on its numbers: **do not edit it**, and add real content to `public/data/` instead. The one exception: when a
schema change makes a new field required, add that field here too. See `docs/TESTING.md`.
