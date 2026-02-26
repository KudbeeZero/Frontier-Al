# Follow-Up: Complete KRONOS Logic Extraction

## Status
Partial extraction completed.
- server/ai/kronos.ts created
- runKronosTurn scaffold added
- storage.ts partially updated

## Remaining Work
- Fully migrate all KRONOS expansion + attack logic out of storage.ts
- Remove legacy nested KRONOS logic blocks
- Verify no duplicate behavior remains
- Confirm `tsc --noEmit` passes clean
- Confirm server boots successfully
- Add unit-style test or simulation harness for runKronosTurn

## Why This Matters
- Prevent brace drift
- Reduce storage.ts complexity
- Make ADR + treasury integration safer
- Improve production stability under high traffic (whale scenarios)

## Next Session Starting Point
1. Open storage.ts and identify remaining KRONOS blocks.
2. Move remaining logic into runKronosTurn.
3. Verify compile.
4. Commit clean extraction.

