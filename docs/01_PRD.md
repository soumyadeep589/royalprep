# RoyalPrep central product requirements

Revision 2 — 21 November 2026

The supplied 52-screen inventory is the release scope and supersedes earlier MVP exclusions. Inventory screen 17 is Practice question and 46 is Question bank. Deliver the student website, separately deployed admin website, bare React Native Android application and shared PostgreSQL backend.

## Architecture and scope decisions

One web repository contains student and admin React applications with independent entry points, builds, environment settings and deployments. Keep Android and backend in their own repositories. TypeScript is used throughout. Public screens are web-first; Android implements student screens 14–36, sign-in and policy/help navigation. Weekly Grand Mock registration is incorporated into screens 18 and 47. Audio, videos, revision, flashcards, custom mocks and commercial/admin operations previously deferred are included. Missing educational content may show an accurate coming-soon state while its underlying workflow is delivered.

## Screen inventory and acceptance

Admin routes are relative to the admin deployment.

| No | Screen | Route | Required behavior |
|---|---|---|---|
| 1 | Home page | / | Published hero, benefits, navigation and primary actions; staff can preview, publish and restore hero revisions. |
| 2 | Course all chapters | /course | Published chapters by paper and subject with search, access indicators and chapter links. |
| 3 | Chapter preview page | /course/:slug | Public chapter overview, topics, approved sample and sign-in or purchase action. |
| 4 | Pricing | /pricing | Available plans, durations, supported markets and currencies, feature comparison and approved terms. |
| 5 | Free tool eligibility calculator | /tools/eligibility | Calculate eligibility from collected inputs and approved versioned rules with source and verified date. |
| 6 | Free tool orientation guide | /tools/orientation | Published guide contents, section navigation and approved resource download if enabled. |
| 7 | Free tools all tools | /tools | Catalog linking calculator, guide, planner, quiz, flashcards and exam dates. |
| 8 | RoyalPrep Radio recall audio | /radio | Public catalog, approved previews, playback controls and eligible full episode links. |
| 9 | Free tool study planner | /tools/planner | Target date and weekly availability create editable chapter tasks; signed-in students save plans. |
| 10 | Free tool daily 5-question quiz | /tools/daily-quiz | Five common questions per date, one scored submission per account, explanations and completion. |
| 11 | Free tool flashcards | /tools/flashcards | Browse free cards, flip and record recall ratings when signed in. |
| 12 | Free tool 2027 exam dates | /exam-dates | Admin-verified sittings, application deadlines, fees, timezone and source; year is data. |
| 13 | Sign up Log in | /sign-in | Email OTP registration/login with resend limits, expiry, session restoration and safe return navigation. Local development logs a code on the backend console; production OTP delivery requires a configured provider. |
| 14 | Dashboard | /app | Access, continue reading, upcoming mocks, due cards, recent results and study tasks. |
| 15 | Chapter library | /app/chapters | Paper/topic filters, progress, search and access status. |
| 16 | Reading a chapter | /app/chapters/:id | Protected notes/diagrams, anchors, progress, highlights, saved sections and tutor. |
| 17 | Practice question | /app/practice/:id | Single-best-answer question, selection and tutor-mode reveal with explanation, flags and reports. |
| 18 | Mocks today's Daily Mock and custom mocks | /app/mocks | Daily window, weekly Grand Mock registration, on-demand mocks, custom builder and resume. |
| 19 | Create a custom mock | /app/mocks/new | Multiple chapters, count, all/unattempted/incorrect/bookmarked filter and timed/tutor mode with inventory validation. |
| 20 | Taking a custom or daily mock | /app/attempts/:id | Server deadline, navigation, acknowledged saves, resumption, flags and idempotent submit. |
| 21 | Mock review and analytics | /app/attempts/:id/review | Authorized explanations, topic breakdown, wrong-answer review and coverage after review release. |
| 22 | Daily Mock leaderboard | /app/mocks/:id/leaderboard | Valid scored entries, nickname privacy, score/time ties, cohort size, provisional/final standings and percentile. |
| 23 | Mock exam like Pearson VUE | /app/exam/:id | Dedicated exam shell, timer, grid, flags, review, strike-through, highlight, calculator and warnings when enabled. |
| 24 | Results | /app/results | Filtered history, scores, trends, chapter heatmap, percentile, estimated pass band and readiness with low-data states. |
| 25 | Retain Revision Packs | /app/revision | Chapter pearls, diagrams, numbers, mnemonics, yield/recall filters and send-to-flashcards. |
| 26 | Retain Flashcards | /app/flashcards | Chapter decks, due counts, flip and Again/Hard/Good/Easy scheduling across devices. |
| 27 | Retain RoyalPrep Radio | /app/radio | Entitled playback, seek, speed, resume progress and chapter linkage. |
| 28 | Learn Masterclass videos | /app/videos | Entitled playback, captions when supplied, progress and accurate coming-soon states. |
| 29 | Recalls mixed bag | /app/recalls | Approved recall topics and mixed practice from tagged question revisions. |
| 30 | Recalls Fawzia sheet | /app/fawzia | Approved tagged concepts, coverage counts and linked topic/chapter practice. |
| 31 | Retain My Mistakes | /app/mistakes | Incorrect-answer list, chapter filter, targeted retest and updated mastery. |
| 32 | Retain Saved | /app/saved | Saved questions/sections, highlights and personal notes with edit/remove and stable source links. |
| 33 | Retain Last week and exam eve | /app/last-week | Date-aware revision checklists, resources and per-user completion. |
| 34 | AI tutor | /app/tutor | Chapter-grounded sourced answers, owned chat history, continuation, quotas and active-mock restriction. |
| 35 | Profile and privacy | /app/profile | Profile, nickname and ranking consent, devices, session revoke, privacy preferences, export and deletion request. |
| 36 | Choose a plan and pay | /app/billing | Checkout states, coupon redemption, configured renew/upgrade choices, invoices and expiry. |
| 37 | Terms and conditions | /terms | Published versioned client-approved terms. |
| 38 | Privacy policy | /privacy | Published policy and processor disclosures. |
| 39 | Refund and cancellation | /refunds | Published eligibility and instructions aligned to commercial policy. |
| 40 | Delivery policy | /delivery | Published digital-access fulfillment policy. |
| 41 | Contact us | /contact | Support details and validated consent-aware enquiry with delivery feedback. |
| 42 | About us | /about | Approved company, founder and team content and media. |
| 43 | Admin sign-in | /sign-in | Separate password-based staff login with mandatory second-factor enrollment and recovery, session expiry and protected admin routes. |
| 44 | Admin dashboard | / | Date-filtered users, sales by currency, activity, content usage and pending actions. |
| 45 | Content manager | /content | Versioned chapters, notes, packs, flashcards, media and public CMS including hero upload/preview/publication. |
| 46 | Question bank | /questions | MCQ search/filters, CSV/JSON validation, preview/commit, tags, options/explanations and immutable versions. |
| 47 | Mocks and Daily Mock | /mocks | Calendar, curated sets, blueprint totals, Grand Mock registration, eligibility, timing, review release and rankings. |
| 48 | Users and sessions | /users | Student search, plan change/extension with reason, devices, revoke and account flags. |
| 49 | Plans payments and coupons | /commerce | Versioned market prices, coupon caps, transaction lookup, refunds, credit notes and reconciliation. |
| 50 | Reports and broadcasts | /communications | Content reports, replies, audience selection, email/in-app preview and deduplicated delivery. |
| 51 | SEO exam facts and leads | /seo | Metadata, canonicals, indexing, sitemap, sourced facts and consent-filtered leads/export. |
| 52 | Team switches and audit log | /settings | Invitations, roles, second-factor enrollment, runtime switches and immutable audit search. |

## Domain rules

- All clients use the same identity, entitlements, published content and authoritative scoring.
- Public quiz has five questions per sitting; Daily Mock size is configured separately; custom and on-demand mock counts follow their settings.
- Ranked Daily and Grand Mocks permit one scored attempt per account per sitting; reconnect resumes it.
- Scheduled attempt deadline is the earlier of its duration limit and closing time; late saves are rejected.
- Tutor-mode practice reveals only after an explicit answer/reveal action; exam explanations are held until finalization and review release.
- Question and scoring revisions used by an attempt are immutable even when staff later correct source content.
- Rank by score descending then elapsed time ascending, with exact ties sharing rank; percentiles require a configured cohort threshold.
- Pass bands and readiness are RoyalPrep study estimates with versioned approved formulas and low-data states.
- Flashcard review events are idempotent and due scheduling is shared across devices.
- Tutor uses bounded recent chat context, approved chapter excerpts and a shared daily/global cap; active timed mocks block tutor requests.
- All business text, uploaded material, media URLs, facts, rules, plan data and publication flags are API managed; code owns stable tokens, route mechanics and technical fallbacks.

## Acceptance journeys

A visitor previews a chapter, signs in, purchases an eligible plan and gains access once on web and Android. A learner reads notes, saves a section, resumes media, completes practice, reviews mistakes and rates due cards. A student creates a valid custom test or registers for a scheduled mock and resumes without resetting time. Results, leaderboards and explanations release according to the sitting revision. Staff preview/publish/restore hero content, validate an import, publish a mock and reconcile a refund without duplicate access or accounting effects.

Every screen supports loading, empty, invalid-input, denied, expired-session, network and stale-update states where applicable. Validate mobile/tablet/desktop, keyboard, large text and reduced motion.

## Dependencies and protection

RoyalPrep supplies approved notes, MCQs, media, captions, recall material rights, facts, policies, terms and provider accounts. Third-party API/AI usage, Cloudinary, hosting, database, email, transaction/FX fees, licences and store fees are excluded from development costing. This document contains no price or delivery date commitment.

Web uses authorized delivery, watermarks and print deterrents; standard websites cannot guarantee prevention of OS screenshots. Android applies FLAG_SECURE before protected content and tests recording, casting and recents on supported devices.

## Implementation decisions needing client confirmation

Confirm plans/auto-renew policy, international gateway markets, device limits, editorial permissions, broadcast channels, retention periods, schedule timezone, readiness/pass-band formulas and minimum cohort. iOS and native in-app billing require separate scope. Persist these configurable decisions and verify approved values before release.
