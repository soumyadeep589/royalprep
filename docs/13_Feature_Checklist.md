# Feature checklist

This is the implementation status, not a release certification. Module names below identify planned implementation areas, not necessarily existing directories. See [screen traceability](./11_Screen_Traceability.csv) for the target routes and requirements, and [execution plan](./12_Execution_Plan.md) for tasks. Android has a preliminary demo sign-in, chapter library and practice flow; other native screens remain unimplemented. Separate student/admin web entry points and build commands exist. Payment implementation is excluded from the current request.

| Screen | Implementation area | Status |
|---|---|---|
| 1 Home | Public site / hero CMS | Partial: text hero, draft/preview/publish/restore and live question counts; assets, other managed content and SSR remain |
| 2 Course chapters | Public course | Partial: searchable published practice chapters; paper/subject and access metadata remain |
| 3 Chapter preview | Public course | Partial: published question counts and practice link; overview, topics and approved sample remain |
| 4 Pricing | Commerce / public site | Not started |
| 5 Eligibility calculator | Public tools | Not started |
| 6 Orientation guide | Public tools / CMS | Not started |
| 7 All tools | Public tools | Partial: planner and catalog links; other tools remain unavailable |
| 8 Public radio | Media | Not started |
| 9 Study planner | Study planning | Partial: editable per-chapter proposal on selected weekdays, authenticated save and version checks; approved topic weights remain |
| 10 Daily quiz | Assessments | Not started |
| 11 Free flashcards | Flashcards | Not started |
| 12 Exam dates | Public tools / CMS | Not started |
| 13 Sign up / log in | Student identity | Partial: email-only account and development-only console OTP on web and Android; no production delivery or ownership verification |
| 14 Dashboard | Student dashboard | Partial: practice, study tasks, mocks, results, personal cards and opt-in continue reading; access and other summaries remain |
| 15 Chapter library | Study catalog | Partial: searchable practice chapters and opt-in published chapter notes; paper/topic filters, note search and entitlements remain |
| 16 Reading a chapter | Study content | Partial: opt-in plain-text sections with saved last-read position and revision checks; diagrams, highlights, saved sections, tutor, entitlements and production authorization remain |
| 17 Practice question | Practice | Partial: published questions, saved latest answers, explanations and reports; full practice attempt flow and flags remain |
| 18 Mocks | Assessments | Partial: custom mock list; daily and grand mocks remain |
| 19 Create custom mock | Assessments | Partial: chapter, count and duration selection; history filters and tutor mode remain |
| 20 Take mock | Assessments | Partial: timed custom mock, answer/flag persistence and expiry; other mock types remain |
| 21 Mock review | Results / analytics | Partial: custom mock answers and explanations; advanced analytics remain |
| 22 Leaderboard | Results / rankings | Not started |
| 23 Exam-like mock | Assessments | Not started |
| 24 Results | Results / analytics | Partial: custom mock scores and review; comprehensive analytics remain |
| 25 Revision packs | Revision | Not started |
| 26 Retain flashcards | Flashcards | Partial: personal cards and review scheduling; approved shared decks remain |
| 27 Retain radio | Media | Not started |
| 28 Masterclass videos | Media | Not started |
| 29 Recall mixed bag | Recall | Not started |
| 30 Fawzia sheet | Recall | Not started |
| 31 My mistakes | Revision | Partial: latest practice answers and submitted answers among the latest 100 custom mocks, with per-question retest; full history and mastery analytics remain |
| 32 Saved | Saved items / notes | Not started |
| 33 Last week | Study planning | Not started |
| 34 AI tutor | Tutor | Not started |
| 35 Profile and privacy | Student identity / privacy | Partial: development-only account deactivation retains all records and blocks sign-in; profile, consent, devices, export and production identity remain |
| 36 Choose plan and pay | Commerce | Not started |
| 37 Terms | Public policy / CMS | Not started |
| 38 Privacy policy | Public policy / CMS | Not started |
| 39 Refund and cancellation | Public policy / CMS | Not started |
| 40 Delivery policy | Public policy / CMS | Not started |
| 41 Contact | Enquiries | Not started |
| 42 About | Public site / CMS | Not started |
| 43 Admin sign-in | Staff identity | Partial: shared password and development-only console OTP; real delivery, individual accountability, recovery, durable replay protection and secure sessions remain |
| 44 Admin dashboard | Admin analytics | Partial: question and report counts; other metrics remain |
| 45 Content manager | Admin CMS | Partial: text hero and opt-in chapter-note drafts/publication/restore; review roles, audit, asset support and other content remain |
| 46 Question bank | Admin questions | Partial: question CRUD, publication and CSV import; full validation workflow and immutable versions remain |
| 47 Mocks and Daily Mock | Admin assessments | Not started |
| 48 Users and sessions | Admin users | Not started |
| 49 Plans, payments and coupons | Admin commerce | Not started |
| 50 Reports and broadcasts | Admin communications | Partial: question reports view only |
| 51 SEO, exam facts and leads | Admin site operations | Not started |
| 52 Team, switches and audit | Admin team / operations | Not started |

The backend uses PostgreSQL for all application data. PostgreSQL migrations, locking, concurrency and backup/restore still need verification against a real PostgreSQL server. The current shared admin identity and audit events are prototypes, not production access control or an immutable staff audit system. Real messaging, AI and media integrations, deployment assets, end-to-end testing and production security hardening remain outstanding; payment is excluded.
