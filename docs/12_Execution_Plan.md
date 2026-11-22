# RoyalPrep execution plan

Revision 1 — 21 November 2026

## 1. Purpose and scope

This is the delivery backlog for the complete 52-screen product in [01_PRD.md](./01_PRD.md). It turns the product requirements, technical designs, API contracts, and traceability matrix into sequenced, reviewable tasks. It is an execution aid, not a price, schedule, staffing commitment, or substitute for client approval.

The target includes the student website, separately deployed admin website, Android app, and shared API described in [00_README.md](./00_README.md), [03_Web_Repository_TAD.md](./03_Web_Repository_TAD.md), [05_Android_TAD.md](./05_Android_TAD.md), and [07_Backend_PostgreSQL_TAD.md](./07_Backend_PostgreSQL_TAD.md). A phase may be released independently only when its required upstream decisions and cross-client contracts are complete.

### Current implementation baseline

The checked-in code is a smaller practice/question-bank application, not yet the 52-screen target:

- The frontend currently has a reference-inspired landing page at `/`, a published-question chapter list at `/study/library`, student demo sign-in at `/sign-in`, and `/practice`, `/admin`, and `/admin/questions` routes.
- The backend currently exposes health, admin login, question CRUD/list/import/report review, practice question listing/answering, and question reports.
- The backend uses PostgreSQL for all application data. Versioned SQL migrations create the question/report, hero, study-plan, custom-attempt and flashcard tables; legacy data transfer is not automatic.
- The current source includes development-only dummy email OTP flows and email-only student account records; it does not yet include real email verification, production sessions, staff roles, commerce, mock scheduling, or the other target product areas.
- The requested account-deletion behavior is automatic soft deletion with all records retained. The development prototype blocks deleted accounts from sign-in and existing sessions; export, restoration, audit, production identity, and a complete privacy policy remain unresolved.
- The requested eventual sign-in direction is Nodemailer with Gmail SMTP for email OTP, and a shared admin account using password plus email OTP. For now a development-only service logs generated codes to the backend console; Gmail delivery is not implemented. Shared admin access differs from the original named-staff requirement and cannot provide individual accountability or role-based permissions.
- The requested browser-session direction is separate same-origin API proxies and HttpOnly cookies for the student and admin deployments, with a separate native token flow. These are not implemented yet.

Treat the documents as the target specification and the source tree as the current implementation baseline. Do not infer that a screen or target architecture is already implemented because it appears in the specifications. Confirm the PostgreSQL deployment, backup and recovery approach before production use.

## 2. How to execute this backlog

- Each unchecked item is a task candidate. Break it into smaller engineering tickets only when that improves ownership or review; preserve the task ID in ticket titles or links.
- Do not mark an item complete until its acceptance evidence is attached: merged change, automated test/build output, and any required manual QA result.
- “Blocked by” is a real prerequisite, not merely the order in which tasks appear. Tasks in the same phase may proceed in parallel when their dependency is met.
- Use the API contracts as the cross-client boundary. Change the contract and its tests before or alongside dependent clients.
- Keep imported, sample, and demonstration medical content clearly labeled. Production educational content, legal text, eligibility facts, commercial terms, and assessment formulas require authorized review.
- For any migration or release, preserve production data and provide a tested backup/restore and rollback path. Never make a destructive data change as part of an unreviewed deployment.
- The PRD's full screen inventory remains in scope. Phases group implementation work; they do not silently remove features from release scope.

### Task-level definition of done

For each applicable task:

1. Requirements and loading, empty, validation, denied, expired-session, network, and stale-update states are implemented.
2. Authorization, ownership, validation, rate limiting, idempotency, and audit behavior are enforced on the server where applicable; hiding a client control is not authorization.
3. Focused automated tests cover the changed behavior and important failure cases.
4. Type checks and the narrowest applicable build/test command pass.
5. UI changes pass keyboard, responsive, zoom, and accessibility checks relevant to the screen.
6. API and data changes are documented, versioned where required, and compatible with the supported deployment sequence.
7. User-facing text, content sources, and operational configuration have an identified owner and approval.

## 3. Phase 0 — Confirm scope and decision gates

**Exit gate:** Written decisions are recorded, a release sequence is approved, and no feature implementation depends on an unresolved architectural choice.

- [ ] **EX-0.1 — Approve release sequencing.** Confirm whether all 52 screens are delivered in one launch or in gated releases. Keep all PRD requirements in the backlog either way.
- [ ] **EX-0.2 — Approve repository and deployment topology.** Decide whether to retain the current repository and add the target apps, or split student web, admin web, Android, and API into the repositories proposed in the TADs. Specify independent build artifacts, hostnames, environments, and owners.
- [ ] **EX-0.3 — Confirm PostgreSQL operations.** Select the managed or self-hosted PostgreSQL environment, access controls, backup/restore procedure and operational ownership; rehearse recovery before production use.
- [ ] **EX-0.4 — Confirm session and identity policy.** The current slice uses a configured admin password and development-only student demo OTP. The target requires staff second-factor enrollment and recovery; before production, approve real OTP delivery, named staff identities/roles, session/device limits, cookie origins, refresh/revocation, retention, and account deletion/export rules.
- [ ] **EX-0.5 — Resolve commercial and scheduling inputs.** Approve plans, supported markets/currencies, renewals, gateway, coupons, refunds, device limits, exam schedule timezone, Daily/Grand Mock rules, and registration eligibility.
- [ ] **EX-0.6 — Assign content and medical review owners.** Identify owners/approvers for MCQs, explanations, notes, recall materials and rights, source references, eligibility rules, exam dates, readiness/pass-band formulas, and captions.
- [ ] **EX-0.7 — Confirm privacy, legal, and communications policy.** Approve terms, privacy/refunds/delivery policies, consent requirements, data retention, deletion/export handling, broadcast channels, and support workflow.
- [ ] **EX-0.8 — Select external providers and environments.** Confirm hosting/database, email/OTP, payments, media, AI, queue/cache, DNS/TLS, secret injection, and any Android distribution accounts. Document sandbox credentials and production ownership without placing secrets in source control.
- [ ] **EX-0.9 — Confirm brand asset provenance.** Approve the supplied logo variants and canonical locations for web, admin, and Android assets. Ensure the asset source is tracked and licensing/provenance is known.
- [ ] **EX-0.10 — Create a decision log and traceability owner.** Record each decision, approver, date, and affected tasks; assign a maintainer for [11_Screen_Traceability.csv](./11_Screen_Traceability.csv).

## 4. Phase 1 — Stabilize and characterize the current application

**Exit gate:** Existing question/practice behavior has repeatable test coverage and a documented local run path before broader changes begin.

- [ ] **EX-1.1 — Capture the current API behavior.** Add or verify focused tests for login throttling, expired/invalid token, unauthorized admin operations, validation failures, missing records, rate limits, and generic server errors.
- [ ] **EX-1.2 — Capture question lifecycle behavior.** Test create, list, edit with expected version, stale edit conflict, publish/unpublish, and that drafts never appear in practice.
- [ ] **EX-1.3 — Capture answer and report behavior.** Test public payload redaction, correct/incorrect answers, stale question versions, immutable report snapshots, report validation, and report throttling.
- [ ] **EX-1.4 — Capture import guarantees.** Test CSV quoting, optional source, size/row limits, invalid options, duplicate/invalid rows, all-or-nothing behavior, and no writes after validation failure.
- [ ] **EX-1.5 — Verify current UI flows.** Manually exercise `/practice`, `/admin`, and `/admin/questions` at phone and desktop sizes, including loading, empty, errors, expired login, editing, import, reports, and sign-out.
- [ ] **EX-1.6 — Verify PostgreSQL startup and health checks.** Test required environment validation, schema checks, graceful shutdown, and `/api/health` against a real PostgreSQL server.
- [ ] **EX-1.7 — Record reproducible local commands.** Verify frontend/backend install, dev, build, and backend test commands against lockfiles and update the root README if commands or configuration have changed.
- [ ] **EX-1.8 — Establish CI baseline.** Add or verify separate frontend/backend type/build/test jobs, lockfile-based dependency install, and a protected deployment secret policy.

## 5. Phase 2 — Platform foundation, contracts, data, and identity

**Blocked by:** Phase 0 decisions.  
**Exit gate:** A versioned API contract, target persistence foundation, separate principal authorization, and deployable app skeletons are available.

### 5.1 Contract and repository foundations

- [ ] **EX-2.1 — Map current routes and data to target domains.** Identify what can be retained, replaced, or migrated; include question IDs/versions/reports and compatibility requirements.
- [ ] **EX-2.2 — Establish the agreed repository/workspace layout.** Create student, admin, shared UI/contracts, API, and Android project boundaries as approved; prevent student builds from importing admin-only code.
- [ ] **EX-2.3 — Define API versioning and error envelope.** Implement `/api/v1`, request IDs, consistent errors, validation semantics, pagination, timestamps, and idempotency conventions from [08_API_Contracts.md](./08_API_Contracts.md).
- [ ] **EX-2.4 — Generate and validate OpenAPI.** Add a source-of-truth schema, contract checks in CI, generated TypeScript clients, and compatibility checks for independently deployed clients.
- [ ] **EX-2.5 — Define runtime configuration.** Separate public runtime settings from server-only secrets; validate required values at process start and document development/staging/production configuration.
- [ ] **EX-2.6 — Add structured logging and correlation.** Include request/job correlation IDs and useful error context; redact credentials, OTPs, tokens, payment data, and protected educational content.

### 5.2 Persistence and migration

- [ ] **EX-2.7 — Finalize the relational schema.** Review entity ownership, immutable content/question revisions, attempt snapshots, unique constraints, indexes, money/time representations, and retention against [07_Backend_PostgreSQL_TAD.md](./07_Backend_PostgreSQL_TAD.md).
- [ ] **EX-2.8 — Add versioned SQL migrations.** Create migration apply/status tooling, least-privilege runtime roles, test database setup, and forward-compatible expand/contract conventions.
- [ ] **EX-2.9 — Implement repository transaction boundaries.** Add tested service/repository patterns for optimistic edits, idempotent writes, row locking, and transaction rollback.
- [ ] **EX-2.10 — Decide and execute data migration plan.** If moving to PostgreSQL, export and reconcile existing questions/reports, preserve IDs and versions where possible, validate counts and content, rehearse rollback, and obtain approval before production cutover.
- [ ] **EX-2.11 — Add database backup and restore rehearsal.** Automate a protected backup, restore it into staging, verify representative question/report/content records, and record recovery evidence.
- [ ] **EX-2.12 — Add outbox/job foundation.** Implement transactional event creation, unique job keys, retry budgets, dead-letter visibility, and a safe local worker mode before asynchronous imports, broadcasts, and integrations depend on it.

### 5.3 Authentication, privacy, and authorization

- [ ] **EX-2.13 — Implement student OTP lifecycle.** A development-only demo exists with expiry, attempt limits, single use and return navigation. Production delivery, hashed code storage, persistent user records and secure sessions remain open.
- [ ] **EX-2.14 — Implement student session/device management.** Rotate refresh tokens safely, revoke one/all sessions, coalesce refresh calls, and expose device/session metadata without secrets.
- [ ] **EX-2.15 — Implement staff login and second factor.** The prototype requires a shared configured password and a development-only dummy email challenge. Real OTP delivery and verification, named staff identities, recovery, durable replay protection, secure sessions and role permissions remain open.
- [ ] **EX-2.16 — Implement role and permission checks.** Define owner, content editor, medical reviewer, and support permissions; enforce capability and entity scope in service methods and test denial cases.
- [ ] **EX-2.17 — Secure browser mutation boundaries.** Configure exact allowed origins, host-only Secure/HttpOnly cookies as decided, CSRF defenses, no-store responses for private content, and student/admin origin isolation.
- [ ] **EX-2.18 — Implement consent, export, and deletion workflows.** Validate authorization, queue long-running jobs, record auditable state, honor retention policy, and avoid returning another user's data.
- [ ] **EX-2.19 — Establish append-only audit events.** Record actor, action, target, time, reason, and correlation ID for sensitive changes; ensure app paths cannot modify or delete audit history.

## 6. Phase 3 — Web shells, public content, tools, and policies (screens 1–13, 37–42)

**Blocked by:** Phase 2 contract/auth foundations and approved brand/content inputs.  
**Exit gate:** Public routes render approved published content; private routes and staff data are not exposed in public output.

### 6.1 Shared UI and public web foundation

- [ ] **EX-3.1 — Implement design tokens and fonts.** Import the approved source values from [02_Design_System.md](./02_Design_System.md); verify contrast, fallback fonts, focus styles, and light/dark behavior if dark mode is enabled.
- [ ] **EX-3.2 — Place approved logo assets.** Add canonical 256/512 variants to the agreed public/native asset locations, define alt/decorative usage, and verify responsive sizing and app icon output.
- [ ] **EX-3.3 — Build shared accessible primitives.** Add header/nav, buttons, forms, cards, dialogs, loading skeletons, error/empty states, toasts, and responsive containers with keyboard and focus tests.
- [ ] **EX-3.4 — Build the student public app shell.** Add routes, responsive navigation, not-found handling, runtime configuration, and a route-level error boundary.
- [ ] **EX-3.5 — Implement public rendering and SEO.** Ensure approved published content, title/description/canonical/social metadata, 404 behavior, sitemap, and structured data are correct in the initial response.
- [ ] **EX-3.6 — Build shared CMS block rendering.** Render only validated published schema; preview must use the same renderer and revision as the public page.

### 6.2 Marketing, catalog, and free tools

- [ ] **EX-3.7 — Screen 1: Home and hero.** The prototype has a PostgreSQL-backed text hero with private draft, shared preview, publication and restoration, plus live question counts and planner navigation. Real PostgreSQL verification, images/assets, CMS-managed remaining business content, SEO/SSR and production authorization remain outstanding.
- [ ] **EX-3.8 — Screens 2–3: Course catalog and chapter preview.** Add paper/subject grouping, search, access indicators, chapter topics, approved sample content, and sign-in/purchase actions.
- [ ] **EX-3.9 — Screen 4: Pricing.** Display approved plans, durations, market/currency, feature comparison, taxes/terms disclosures, and unavailable-market states.
- [ ] **EX-3.10 — Screen 5: Eligibility calculator.** Implement validated inputs, versioned approved rules, source and verified date, boundary tests, and an explicit unavailable/expired-rules state.
- [ ] **EX-3.11 — Screens 6–7: Orientation guide and free tools catalog.** Implement published guide sections, accessible navigation/download where enabled, and accurate links/status for every tool.
- [ ] **EX-3.12 — Screen 8: Public RoyalPrep Radio.** Build catalog, preview eligibility, accessible audio controls, playback errors, and links to entitled full episodes.
- [ ] **EX-3.13 — Screen 9: Study planner.** Validate target dates and weekly availability, generate editable tasks, and persist only for authenticated owners with version checks.
- [ ] **EX-3.14 — Screen 10: Daily five-question quiz.** Serve exactly five eligible questions for the date, enforce one scored submission per account, and show explanations/completion per approved release rules.
- [ ] **EX-3.15 — Screen 11: Free flashcards.** Build browse/flip states and signed-in review ratings; ensure duplicate review events cannot apply twice.
- [ ] **EX-3.16 — Screen 12: Exam dates.** Render only verified sittings, deadlines, fees, timezone, source, and verified-at metadata; test past, changed, and missing dates.
- [ ] **EX-3.17 — Screen 13: Student sign-up/login.** Complete OTP UI, resend timer, invalid/expired states, session restoration, sign-out, and safe return route.

### 6.3 Policies and public information

- [ ] **EX-3.18 — Screens 37–40: Terms, privacy, refunds, and delivery.** Publish approved versioned text, effective date, and accessibility/readability; do not author policy promises in code.
- [ ] **EX-3.19 — Screen 41: Contact.** Validate fields and consent, rate-limit submissions, show delivered/failed status, and protect contact details from abuse.
- [ ] **EX-3.20 — Screen 42: About.** Render approved company/team information and media with responsive alt text and unpublished-content handling.
- [ ] **EX-3.21 — Public route QA.** Verify mobile/tablet/desktop navigation, metadata, canonical URLs, crawl/noindex boundaries, cache invalidation, and public 404s.

## 7. Phase 4 — Student portal and learning (screens 14–17, 25–33, 35)

**Blocked by:** Student identity, entitlement, content/question revision services, and Phase 3 app shell.  
**Exit gate:** An authenticated learner can access entitled content, retain state across sessions/devices, and access only their own records.

### 7.1 Portal, reading, and practice

- [ ] **EX-4.1 — Screen 14: Dashboard.** Compose access status, continue-reading, upcoming mocks, due cards, recent results, and study tasks; test empty/new-account and partial-service states.
- [ ] **EX-4.2 — Screen 15: Chapter library.** A searchable list of chapters with published practice questions and chapter-filtered practice is available. Paper/topic filters, notes, progress, access states, pagination, and filter reset remain outstanding.
- [ ] **EX-4.3 — Screen 16: Chapter reader.** An opt-in development slice supports versioned plain-text sections, stable anchors and a last-read checkpoint, including retired-section handling. Diagrams, highlights, saved sections, tutor entry, entitlements, production authorization and real PostgreSQL concurrency verification remain.
- [ ] **EX-4.4 — Protect paid content delivery.** Verify entitlements for every request, use approved authorized delivery, watermark safely, and test expired grants and unauthorized direct URLs.
- [ ] **EX-4.5 — Screen 17: Practice question.** Implement answer selection, explicit tutor-mode reveal, explanations, flags, report flow, and distinction between pending and server-acknowledged state.
- [ ] **EX-4.6 — Question version behavior.** Freeze question revisions used by a practice/mock attempt; test edits made after attempt start and preserve immutable report context.

### 7.2 Revision, retention, and personal study

- [ ] **EX-4.7 — Screen 25: Revision packs.** Add chapter packs, pearls/diagrams/numbers/mnemonics, yield/recall filters, and stable references to published revisions.
- [ ] **EX-4.8 — Screen 26: Spaced flashcards.** Implement due decks, flip, Again/Hard/Good/Easy scheduling, unique review events, cross-device sync, and due-count recalculation.
- [ ] **EX-4.9 — Screen 29: Mixed recalls.** Render approved, provenance-tagged topics and build practice only from eligible published question revisions.
- [ ] **EX-4.10 — Screen 30: Fawzia sheet.** Show approved tagged concepts, coverage counts, source/provenance, and linked chapter/practice routes.
- [ ] **EX-4.11 — Screen 31: My Mistakes.** Derive owned incorrect responses, filter by chapter, retest eligible revisions, and update mastery without altering historical results.
- [ ] **EX-4.12 — Screen 32: Saved.** Support owned saved questions/sections, highlights, personal notes, edit/remove, version conflict, and unavailable-source states.
- [ ] **EX-4.13 — Screen 33: Last week and exam eve.** Render date-aware approved checklists/resources and persist per-user completion with timezone boundary tests.
- [ ] **EX-4.14 — Screen 35: Profile and privacy.** Add profile/nickname, ranking consent, devices, revocation, preference controls, export, and deletion request states.
- [ ] **EX-4.15 — Learning-state ownership tests.** Attempt cross-account access and stale concurrent edits for progress, notes, plans, saved items, card state, and profile.

## 8. Phase 5 — Assessment engine, mocks, results, and rankings (screens 18–24)

**Blocked by:** Immutable question revisions, student identity, persistence concurrency model, and approved mock rules.  
**Exit gate:** Attempts obey authoritative server deadlines and scoring; concurrent/repeated requests cannot create duplicate results or rankings.

- [ ] **EX-5.1 — Screen 18: Mock hub.** Show Daily Mock windows, Grand Mock registration, on-demand and custom mocks, eligibility, and resumable attempts.
- [ ] **EX-5.2 — Screen 19: Custom mock builder.** Implement chapter selection, count, all/unattempted/incorrect/bookmarked filters, timed/tutor mode, and server-verified inventory counts.
- [ ] **EX-5.3 — Define immutable mock/sitting versions.** Freeze selection filters, question revisions, scoring, count, duration, open/close/review windows, and timezone at publication.
- [ ] **EX-5.4 — Registration and attempt creation.** Enforce eligibility and one scored attempt per account/sitting; make start requests idempotent and freeze selected questions atomically.
- [ ] **EX-5.5 — Screen 20: Attempt shell.** Implement question navigation, flags, answer saves, server deadline display, reconnect/resume, status acknowledgements, and safe interruption recovery.
- [ ] **EX-5.6 — Enforce answer-save deadline and stale writes.** Reject late saves, resolve version conflicts with authoritative state, do not replay unsent answers after expiry, and test two-device mutation order.
- [ ] **EX-5.7 — Idempotent finalization.** Lock attempt state, wait for eligible in-flight saves, calculate result once, return the existing result on duplicate submit, and test close-boundary races.
- [ ] **EX-5.8 — Screen 23: Exam-like interface.** Add timer, question grid, review flags, permitted strike-through/highlight/calculator, warning dialogs, keyboard support, and mobile grid drawer.
- [ ] **EX-5.9 — Screen 21: Review and analytics.** Release explanations only when permitted; show wrong answers, chapter breakdown, coverage, and unavailable/not-yet-released states.
- [ ] **EX-5.10 — Screen 24: Results.** Show owned history, filters, scores, trends, chapter heatmap, readiness/pass-band estimates, and explicitly labeled low-data states.
- [ ] **EX-5.11 — Screen 22: Leaderboards.** Rank valid attempts by score then elapsed time, share exact ties, apply nickname consent and cohort threshold, and freeze standings at close.
- [ ] **EX-5.12 — Validate scoring analytics.** Compare deterministic known attempt fixtures against score, breakdown, percentile, readiness, cohort, and ties before enabling production calculations.
- [ ] **EX-5.13 — Assessment abuse and resilience tests.** Test replay, deadline races, duplicate registration, double submit, lost acknowledgements, reconnect, question correction after start, and unauthorized result IDs.

## 9. Phase 6 — Media, tutor, and billing (screens 27–28, 34, 36)

**Blocked by:** Provider choices, entitlements, content provenance, consent, quota policy, and financial/legal approval.  
**Exit gate:** Provider failures and retries are safe; access grants, AI usage, and financial state reconcile without duplicate side effects.

### 9.1 Media and tutor

- [ ] **EX-6.1 — Screen 27: Entitled RoyalPrep Radio.** Add authorized episode playback, seek/speed, resume progress, chapter links, and expired entitlement/grant handling.
- [ ] **EX-6.2 — Screen 28: Masterclasses.** Add entitled video playback, captions when supplied, progress, playback failure/retry, and accurate coming-soon states.
- [ ] **EX-6.3 — Verify media provider capabilities.** Test supported file types, account limits, authenticated delivery, grant renewal, bandwidth, caption tracks, and failure modes before production asset migration.
- [ ] **EX-6.4 — Screen 34: Tutor threads and history.** Implement owned/paginated threads, one active generation per thread, bounded recent context, and sourced chapter/revision citations.
- [ ] **EX-6.5 — Implement tutor retrieval and guardrails.** Search approved published excerpts; return insufficient-source without generation; block active timed mocks; validate citations and input size.
- [ ] **EX-6.6 — Reserve and reconcile tutor quota.** Make request IDs idempotent, apply per-user/global caps, record usage after provider outcomes, and track ambiguous timeouts without double billing.
- [ ] **EX-6.7 — Tutor failure QA.** Test provider outage, timeout, malformed citations, revoked entitlement, quota exhaustion, disabled feature, thread ownership, and source revision changes.

### 9.2 Commerce

- [ ] **EX-6.8 — Screen 36: Student billing.** Display current plan/status/expiry, invoices, configured upgrade/renew options, pending checkout, success, cancellation, and recovery states.
- [ ] **EX-6.9 — Implement server-generated order quotes.** Validate plan, market, currency, coupon and expiry server-side; snapshot price/tax/terms and reject altered client amounts.
- [ ] **EX-6.10 — Verify payment webhooks.** Check provider signature, deduplicate event IDs, handle out-of-order/pending events, and grant entitlement exactly once.
- [ ] **EX-6.11 — Implement refund reconciliation.** Persist intent, use provider idempotency keys, distinguish unknown/pending/completed outcomes, and update access/accounting only after verified provider state.
- [ ] **EX-6.12 — Commerce security and accounting tests.** Test coupon caps, repeated/invalid webhooks, partial/failed payments, duplicate grants, refunds, currency separation, and audit records.

## 10. Phase 7 — Admin operations (screens 43–52)

**Blocked by:** Staff password plus mandatory second factor, permissions, audit events, versioned data, and relevant student/public endpoints.  
**Exit gate:** Sensitive admin actions require least privilege, confirmation/reason where needed, auditable state, and safe retry behavior.

- [ ] **EX-7.1 — Screen 43: Admin sign-in hardening.** Retain password-based login; add mandatory second-factor enrollment/recovery, named staff identities/roles, session revocation, and noindex/no-store behavior before release.
- [ ] **EX-7.2 — Screen 44: Admin dashboard.** Add date/timezone filters, permission-scoped metrics, separate currency totals, pending actions, loading/empty states, and export policy.
- [ ] **EX-7.3 — Screen 45: Content manager.** Implement chapter/note/pack/flashcard/media/public-page revisions, draft/review/approve/publish states, protected preview, asset metadata, and restore-as-new-revision.
- [ ] **EX-7.4 — Hero editorial workflow.** Implement fields, safe CTA targets, alt/decorative state, focal point, shared phone/tablet/desktop preview, optimistic conflict handling, atomic publish/cache invalidation, and audited restore.
- [ ] **EX-7.5 — Screen 46: Question bank.** Add paginated search/filter, tags, explanations/sources, immutable versions, draft/published states, and stale-edit conflict UI.
- [ ] **EX-7.6 — Question import validate/preview/commit.** Validate file limits, schema, option correctness, duplicate identifiers and chapter references; fingerprint the batch; commit only that validated batch once.
- [ ] **EX-7.7 — Screen 47: Mock operations.** Implement calendar, blueprint totals, inventory validation, registration, timing/review controls, question-use warnings, and locked rules after first attempt.
- [ ] **EX-7.8 — Screen 48: Users and sessions.** Add scoped search/detail, devices, revocation, reasoned plan changes/extensions, flags, and explicit protection against unauthorized cross-user access.
- [ ] **EX-7.9 — Screen 49: Plans, payments, and coupons.** Add effective-dated market pricing, limits/caps, transaction lookup, refund workflow, credit notes, and reconciliation status.
- [ ] **EX-7.10 — Screen 50: Reports and broadcasts.** Add report triage/reply, audience preview/count, consent filtering, deduplicated delivery, schedule/retry status, and confirmation before send.
- [ ] **EX-7.11 — Screen 51: SEO, exam facts, and leads.** Add metadata/canonical/index controls, sourced fact verification, consent-filtered lead search/export, and no-store scoped downloads.
- [ ] **EX-7.12 — Screen 52: Team, switches, and audit.** Add invitations, role changes, second-factor status, validated runtime flags, immutable audit search, and privilege-change confirmation.
- [ ] **EX-7.13 — Sensitive-action permission matrix.** Test each role against publish/restore, imports, refunds, access changes, broadcasts, exports, team changes, flags, and audit access.
- [ ] **EX-7.14 — Admin concurrency and retry tests.** Verify stale content/question revisions, duplicate import commits, repeated broadcasts/refunds, and audit event consistency.

## 11. Phase 8 — Android student application (screens 13–36; policies/help navigation)

**Blocked by:** Phase 0 repository/provider decisions, stable API contracts, student authentication, entitlements, and student web domain behavior.  
**Exit gate:** Supported native flows have parity for business rules, safe interruption recovery, and a signed test build.

- [ ] **EX-8.1 — Create bare React Native project.** Set TypeScript, navigation, environment separation, build variants, crash reporting policy, and CI for supported Android API levels.
- [ ] **EX-8.2 — Establish shared contracts and theme.** Consume generated API types and matching approved design tokens/logo assets; test version compatibility and platform font fallbacks.
- [ ] **EX-8.3 — Implement secure native auth.** Add OTP sign-in, in-memory access tokens, Keystore-backed refresh credentials, rotation, logout/revoke, and protected-navigation restore.
- [ ] **EX-8.4 — Implement student shell and routes.** Add dashboard, deep-link guards, back behavior, loading/error states, safe areas, font scaling, and policy/help navigation.
- [ ] **EX-8.5 — Implement screens 14–17.** Build dashboard, chapter library, protected reader, practice/reveal/report; verify ownership, version conflicts, and server-backed progress.
- [ ] **EX-8.6 — Implement screens 18–24.** Build mock hub/custom builder/attempt/exam/review/leaderboard/results with the same deadlines, scoring and release rules as web.
- [ ] **EX-8.7 — Implement screens 25–33.** Build revision, flashcards, radio, video, recalls, mistakes, saved items, and final-week tasks with cross-device synchronization.
- [ ] **EX-8.8 — Implement screen 34 and 35.** Add tutor history/source navigation/quotas and profile/privacy/session/export/deletion states.
- [ ] **EX-8.9 — Implement screen 36 access/billing view.** Show plan, status, expiry, and approved website purchase handoff; do not add unapproved native purchase behavior.
- [ ] **EX-8.10 — Protect native content surfaces.** Apply FLAG_SECURE before protected views, test dialogs/video/recents/background/casting behavior, and document platform limitations.
- [ ] **EX-8.11 — Test native interruption and offline boundaries.** Exercise calls, app background/kill, network loss, expired attempts, media URL renewal, stale writes, and safe restoration from server state.
- [ ] **EX-8.12 — Produce signed testing artifact.** Verify signing configuration is secret-managed, install on physical devices, record API compatibility, and obtain release approval.

## 12. Phase 9 — Cross-cutting QA, deployment, and launch readiness

**Blocked by:** Feature exit gates above.  
**Exit gate:** Release candidate meets agreed functional, security, accessibility, recovery, and operational criteria.

- [ ] **EX-9.1 — Complete screen traceability.** Verify every row in [11_Screen_Traceability.csv](./11_Screen_Traceability.csv) links to implementation, API, test, and release evidence; resolve missing/duplicate mappings.
- [ ] **EX-9.2 — Run responsive and accessibility matrix.** Check 320, 390, 640, 768, 820, 1024, 1100, and 1440px as relevant; tablet rotation, 200% zoom, keyboard, screen reader, reduced motion, and large Android text.
- [ ] **EX-9.3 — Run end-to-end learner journey.** Preview chapter, register, purchase approved plan, read, save, practice, review mistakes, rate cards, resume a mock, and verify synchronized results on web and Android.
- [ ] **EX-9.4 — Run end-to-end staff journey.** Edit/preview/publish/restore hero, validate/commit question import, publish mock, respond to report, change user access, and reconcile a refund with correct permissions/audit.
- [ ] **EX-9.5 — Run security/privacy review.** Verify origin/CSRF/session isolation, password and mandatory staff second factor, student token isolation, ownership, entitlements, exports, rate limits, input handling, direct asset access, secret/log redaction, and retention/deletion workflows.
- [ ] **EX-9.6 — Run load and failure tests.** Measure API/database pools and locks, reconnect/assessment bursts, media delivery, queue lag, provider timeouts, worker retry/DLQ behavior, and agreed availability targets.
- [ ] **EX-9.7 — Configure monitoring and alerts.** Add API health/latency/errors, database saturation, job delay/DLQ, payment reconciliation, media failures, tutor usage/cost, and named alert owners.
- [ ] **EX-9.8 — Automate release artifacts.** Build independent student/admin/API/worker/Android outputs, record versions, scan dependencies/artifacts, and protect production deploy credentials.
- [ ] **EX-9.9 — Rehearse deployment and rollback.** Apply compatible migrations first, deploy API/workers and web artifacts in approved order, verify health/smoke tests, and restore prior app artifacts without destructive database reversal.
- [ ] **EX-9.10 — Rehearse disaster recovery.** Restore a database backup in staging, validate media references and representative records, measure recovery against agreed objectives, and record sign-off.
- [ ] **EX-9.11 — Verify launch content and operational ownership.** Confirm all launch-critical content, policy approvals, provider accounts, support response path, incident owners, and production feature switches.
- [ ] **EX-9.12 — Obtain release approval.** Record acceptance against the agreed launch scope, known limitations, rollback owner, operational handoff, and client sign-off.

## 13. Screen-to-phase map

| Screen group | Execution tasks |
|---|---|
| 1–13: Public site, tools, sign-in | EX-3.7–EX-3.17 |
| 14–17: Student shell, library, reader, practice | EX-4.1–EX-4.6 |
| 18–24: Mocks, attempts, review, leaderboard, exam, results | EX-5.1–EX-5.13 |
| 25–33: Revision, cards, media, recalls, mistakes, saved, last week | EX-4.7–EX-4.14; media details in EX-6.1–EX-6.3 |
| 34–36: Tutor, profile/privacy, billing | EX-6.4–EX-6.12 and EX-4.14 |
| 37–42: Policies and public information | EX-3.18–EX-3.20 |
| 43–52: Staff application and operations | EX-7.1–EX-7.14 |
| Android equivalents and help navigation | EX-8.1–EX-8.12 |
| Cross-product release/quality | EX-9.1–EX-9.12 |

## 14. Release gates

1. **Foundation gate:** Phase 0 decisions, data migration strategy, API contract, identity/security model, and recovery approach are approved.
2. **Public launch gate:** Published content is approved, public/private routing and SEO are verified, and student sign-in/session behavior is secure.
3. **Learning launch gate:** Entitlements, protected content, question revision behavior, saved state, and educational content review are complete.
4. **Assessment launch gate:** Server deadlines, frozen revisions, scoring, idempotent finalization, review release, and ranking rules pass deterministic and concurrency tests.
5. **Commerce launch gate:** Market terms, provider/webhook validation, reconciliation, refund behavior, audit, and support ownership are approved and tested.
6. **Admin launch gate:** Password login and mandatory second factor, role matrix, sensitive-action confirmation, immutable audit, and staff workflows pass authorization tests.
7. **Android launch gate:** Signed build, secure storage, protected screens, supported-device QA, and API compatibility are approved.
8. **Production gate:** CI artifacts, monitoring, backup restore, migration/rollback rehearsal, runbooks, and release sign-off are complete.

## 15. Ongoing change control

- Update this plan and [11_Screen_Traceability.csv](./11_Screen_Traceability.csv) when a requirement, API contract, screen owner, or acceptance condition changes.
- Keep a requirement's source and approval linked to implementation and tests. Do not resolve missing content or policy requirements with invented production copy.
- Reassess downstream tasks when a Phase 0 decision changes, especially storage, auth/session, payment, schedule timezone, app separation, and Android purchasing.
- Record deferred defects and launch limitations explicitly; do not mark a release gate complete based on a successful build alone.
