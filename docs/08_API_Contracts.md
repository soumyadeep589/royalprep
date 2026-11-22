# API contracts

Use /api/v1, UUID identifiers, UTC ISO timestamps, bounded cursor pagination and a consistent error envelope containing code, message, fieldErrors and requestId. Generate OpenAPI and typed clients during implementation. Admin endpoints require staff permissions; student routes require ownership and entitlement independently.

The table describes the target contract. The current prototype uses `/api`, not `/api/v1`, and implements only a subset. Its hero endpoints are documented in the root README; admin password plus dummy email OTP and student dummy email OTP are development-only and do not send email or verify ownership.

| Group | Endpoints | Important behavior |
|---|---|---|
| Public CMS | GET /public/site, /public/pages/:slug, /public/course, /public/chapters/:slug | Published only, ETag, metadata and 404 |
| Public tools | GET /public/tools, /public/guide, /public/exam-dates; POST /tools/eligibility, /tools/planner | Validated inputs, versioned facts and calculation rules |
| Free learning | GET /public/radio, /public/flashcards, /quizzes/today | Explicit free access, five-question quiz sitting |
| Student auth | POST /auth/otp/request, /auth/otp/verify; GET /auth/session | Development logs an expiring code to the backend console, not the response; production delivery provider, refresh and revocation workflows remain future work |
| Staff auth | POST /admin/auth/login, /admin/auth/totp, /admin/auth/refresh, /admin/auth/logout | Separate password-based staff session with mandatory second-factor enrollment and recovery |
| Profile | GET/PATCH /me; GET /me/sessions; DELETE /me/sessions/:id; POST /me/export, /me/delete | Owned preferences, consent and auditable data workflows |
| Study | GET /dashboard, /chapters, /chapters/:id/notes; PUT /chapters/:id/progress | Published revisions, access state and stable anchors |
| Practice | GET /practice/inventory; POST /practice/attempts | Chapter/filter/count validation and frozen question selection |
| Mocks | GET /mocks, /sittings, /sittings/:id; POST /sittings/:id/registrations, /attempts | Scheduled eligibility and one scored ranked sitting |
| Attempt | GET /attempts/:id; PUT /attempts/:id/answers/:questionId, /attempts/:id/flags; POST /attempts/:id/submit, /attempts/:id/reveal | Deadline, save revision, mutation ID, tutor-mode reveal policy |
| Results | GET /results, /results/:id, /results/:id/review, /performance, /sittings/:id/leaderboard | Owned scores, configured release, minimum cohort and frozen rankings |
| Revision | GET /revision/packs, /revision/packs/:id; POST /flashcards/from-revision | Published items, authorized filters and idempotent card creation |
| Cards | GET /flashcards/decks, /flashcards/due; POST /flashcards/:id/reviews | Owner state and unique review event |
| Media | GET /radio, /videos; POST /media/:id/playback; PUT /media/:id/progress | Entitlement checked temporary playback grant and position version |
| Recalls | GET /recalls, /fawzia, /mistakes | Approved tags and student-specific incorrect state |
| Saved | GET/POST /saved; PATCH/DELETE /saved/:id; GET/POST /notes; PATCH/DELETE /notes/:id | Owner checks, stable section references and optimistic edits |
| Plans | GET/PUT /study-plan, /study-plan/tasks/:id; GET /last-week; PUT /last-week/tasks/:id | Versioned per-user study tasks |
| Tutor | GET/POST /tutor/threads; GET /tutor/threads/:id/messages; POST /tutor/threads/:id/messages | Ownership, pagination, source revisions and quota |
| Commerce | GET /plans, /orders, /orders/:id, /invoices/:id; POST /orders; POST /webhooks/:provider | Server quote, coupon checks, verified event, idempotent grant |
| Enquiries | POST /contact, /reports | Validation, consent, bounded payload and rate limits |
| Admin metrics | GET /admin/dashboard | Permission-filtered aggregates and currencies |
| Admin CMS | GET/POST /admin/content; PATCH /admin/content/:id; POST /admin/content/:id/preview, /publish, /restore | Schema validation, expectedRevision and audit |
| Admin hero | GET /admin/site/hero/history; PUT /admin/site/hero/draft; POST /admin/site/hero/preview, /publish, /restore | Shared renderer and published pointer |
| Assets | POST /admin/assets/sign, /admin/assets/complete; GET /assets/:id/content | Scoped upload and delivery checks |
| Questions | GET/POST /admin/questions; PATCH /admin/questions/:id; POST /admin/imports/validate, /admin/imports/:id/commit | Fingerprinted validated batch and immutable question versions |
| Scheduling | GET/PUT /admin/daily-calendar; POST /admin/mocks, /admin/sittings; PATCH /admin/mocks/:id, /admin/sittings/:id | Blueprint validation, registration, windows and review state |
| Users | GET /admin/users, /admin/users/:id; POST /admin/users/:id/plan, /extend, /revoke, /flag | Staff permission, reason and audit |
| Commercial | GET/POST /admin/plans, /admin/prices, /admin/coupons; PATCH /admin/coupons/:id; GET /admin/payments; POST /admin/payments/:id/refund | Monetary constraints and provider reconciliation |
| Communications | GET/PATCH /admin/reports/:id; POST /admin/reports/:id/reply, /admin/broadcasts/preview, /admin/broadcasts | Consent-aware audience snapshot and outbox |
| SEO and leads | GET/PUT /admin/seo/:slug, /admin/exam-facts; GET /admin/leads, /admin/leads/export | Approved metadata, fact verification and consent filter |
| Staff | GET/POST /admin/team; PATCH /admin/team/:id/role; GET/PUT /admin/flags; GET /admin/audit | Least privilege, runtime validation and immutable audit |

## Request rules

Mutations with external side effects accept Idempotency-Key. Reuse with a different payload returns 409. Answer saves contain selectedOptionId, expectedVersion and clientMutationId; return acknowledged server version and server time. Attempts expose question IDs, stems, allowed options and tool flags without answer keys. Reviews expose explanations only when allowed.

Import validation returns batchId, fingerprint, row errors and counts; commit consumes that exact validated batch. Publishing supplies expectedRevision and revisionId. Refund request includes order/payment reference, permitted amount and reason. Tutor message supplies requestId and question; response includes answer status, sources with chapter/section/revision IDs and quota reset timestamp.

Use 401 for absent/expired session, 403 for denied capability, 404 for missing/concealed resources, 409 for stale state or closed attempt, 422 for validation, 429 for quota and 503 for temporary provider failure. Avoid leaking raw SQL, secrets and provider payloads.
