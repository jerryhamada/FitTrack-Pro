# FitTrack Pro — Phase 1 Hardening & QA Pass

## Context

Phase 1 (trainer-side) is built and confirmed working end-to-end — signed in via Clerk on both
desktop and iPhone, dashboard loads. Nothing has been stress-tested yet beyond that one sign-in.
This is a focused pass to click through every screen with realistic data, fix what's broken, and
close out a few deliberate simplifications made during the initial build. Not a new feature phase
— don't start Phase 2 (client PWA) here.

Read `backend/app/`, `frontend/src/`, and the plan at `~/.claude/plans/misty-foraging-pebble.md`
(if still present) for the schema/route/component shape before changing anything.

## 1. Manual QA pass (do this first, in a real browser — use computer-use or the Chrome
extension if connected; otherwise drive it via curl/API calls and report what couldn't be
verified visually)

Walk the full golden path as a trainer:

1. Sign in, land on dashboard (should be empty state first time).
2. Add a client (T2) — confirm the invite link renders and copies.
3. On the client profile (T3), edit goals/phone/unit, add two trainer notes, confirm they persist.
4. Exercise library (T4) — favorite a few exercises, add one custom exercise, filter by category.
5. Program builder (T5) — build a 2-day program using real exercises with sets/reps/weight/RPE
   targets, save it, edit it, assign it to the client.
6. From the client's Programs tab, start a session from an assigned day (T6) — confirm it
   reaches the session log screen.
7. Log a session mirroring `Ava_Burkley_CS.xlsx - Exercise List.csv`'s real quirks: a per-side
   dumbbell set (`15s x 10`), a kg entry on the same exercise as an lbs entry, a skipped set, a
   modifier'd bodyweight set (`B60` push-up), and at least one set that should trigger a PR.
   Confirm the PR banner fires and the rest timer behaves.
8. Finish the session (T7) — confirm volume/PR/duration summary numbers look right by hand.
9. Progress tab (T8) — chart the exercise you just logged, both 1RM and weight metrics; check
   the volume-by-category chart renders.
10. PRs tab (T9) — confirm the PR you hit shows up, and badges (first_session, first_pr) appear.
11. Calendar tab (T10) — confirm today's session shows with the right category color, tap it.
12. Export tab (T11) — download the CSV, open it, sanity check the rows.
13. Activity feed (T13) — confirm session_logged, pr_hit, badge_earned, client_added, invite_sent
    all show up with correct client attribution.
14. Settings (T12) — change business name/default unit, save, reload, confirm it persisted.
15. Archive the client from their profile, confirm they drop off the active dashboard list.

Log every bug found (broken request, wrong number, UI overlap, crash) before fixing anything —
then fix them as a batch.

## 2. Known simplifications to close out

- **Session log doesn't pre-fill program day targets.** When a session is started from an
  assigned `client_program_day_id`, the set-logging form should show that day's planned
  exercises with their target sets/reps/weight as quick-fill suggestions, instead of requiring
  the trainer to search the full exercise list from scratch. `GET /client-programs/{id}` already
  returns the full day structure — fetch it in `SessionLogPage` when `session.client_program_day_id`
  is set and surface it as a "Today's Plan" section above the freeform exercise picker.
- **No automated tests exist anywhere.** Add `backend/tests/` with pytest covering the
  highest-risk logic: `services/pr_detection.py` (mixed units, per-side toggle, rep-count ties,
  bodyweight sets that should never PR), `services/one_rm.py`, and `services/volume.py`. These
  are pure functions/ORM-light — should be fast to test without spinning up the full app. Use a
  test Postgres database or sqlite-with-numeric-shim if a real Postgres test DB is impractical
  (check what's actually feasible before committing to an approach).
- **Mobile viewport not visually verified beyond one phone sign-in.** Screenshot the session log
  screen, dashboard, and program builder at a 390x844 (iPhone) viewport and check for overlap,
  truncated text, or touch targets under ~44px.

## 3. Error/edge-case hardening

- What happens when `POST /sessions/{id}/complete` is called with zero sets logged? Decide
  whether to block it client-side or allow an empty "session" to complete (currently allowed,
  may not be desired).
- Clerk token expiry mid-session: does a stale token surface a clear error, or does it just fail
  silently? Check `lib/api.ts`'s `req()` error handling and `SessionLogPage` specifically, since
  losing a long gym session to a silent 401 would be bad.
- Empty states: exercise library with zero favorites, a client with zero sessions ever, programs
  list with zero templates — confirm each shows a real empty state, not a blank screen or crash.

## Out of scope for this pass

Don't touch the data model, don't start Phase 2 client auth/PWA work, don't add new screens. If
QA surfaces something that clearly needs a schema change, flag it instead of changing migrations
inline — surface it back to the user first.

## Report back

Short summary: what was tested, what broke and got fixed, what's now covered by tests, and
anything still open that needs a product decision before it can be closed.
