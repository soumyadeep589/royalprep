# RoyalPrep practice

The student frontend, admin frontend and backend are independently installable Node projects.

## Backend

Use Node 22 or newer. In `backend`, run `npm ci`, copy `.env.example` to `.env`, and set your PostgreSQL `DATABASE_URL`, `ADMIN_PASSWORD` (12+ characters), `ADMIN_EMAIL`, and `SESSION_SECRET` (32+ characters). Start PostgreSQL, apply the schema with `node --import tsx scripts/migrate-postgres.ts`, then run `npm run dev`. For local testing, the example enables `DUMMY_OTP_ENABLED=true` with `NODE_ENV=development` and binds to `127.0.0.1`. The temporary email service prints the generated verification code to the backend console instead of sending email. Anyone with access to those logs can sign in; do not expose this service publicly or use it with real users' data.

Student sign-in creates an email-only account on first verification. Admin sign-in checks the shared password before issuing a one-use code challenge. Challenges and sessions are process-local, so restarting the backend signs users out and multiple backend processes do not share them. Both sign-in flows are unavailable outside development until real email delivery and verification are implemented. They are not production authentication.

Students can deactivate their account at `/app/profile`. This immediately prevents future sign-in and invalidates access from existing sessions, including sessions on other backend processes. It is a soft deletion: the account and all records are retained, with no automatic purge or self-service restoration. This development-only flow is not a production privacy or legal-compliance solution. Apply migration `008_student_soft_deletion.sql` before deploying this backend version; account status is checked on every authenticated student request. Older backend versions do not enforce this status: do not run them alongside this version or roll back to them after deactivation without separately blocking deleted accounts.

Students call `POST /api/auth/otp/request` with `email`, then `POST /api/auth/otp/verify` with `email` and `code`. Admins call `POST /api/admin/otp/request` with `password`, then `POST /api/admin/login` with the returned `challenge` and a `code`. Codes appear only in the backend console, not in API responses. Challenges expire after five minutes, are single-use, and are invalidated after five incorrect attempts.

## Frontend

In each of `student-frontend` and `admin-frontend`, run `npm ci` and copy `.env.example` to `.env` if you do not already have one. Run `npm run dev` in each folder: the student app uses port 5173 and the admin app uses port 5174. Run `npm run build` in each folder to generate its own `dist`. Each app contains only its own routes and must be served with its own SPA fallback. Shared UI components are currently copied into both projects and must be kept in sync when modified.

The development proxy forwards `/api` to port 4000; if the backend uses another port, set `VITE_API_URL` to its origin. Configure the backend and reverse proxy for the actual frontend origins.

### Vercel frontends

Import the repository as two Vercel projects with framework preset Vite. Set their root directories to `student-frontend` and `admin-frontend` respectively. Each project uses `npm ci`, build command `npm run build`, and output directory `dist`. Each folder has its own `vercel.json` SPA fallback. Update existing Vercel project settings before deploying the restructured repository.

Set `VITE_API_URL` on both projects to the HTTPS backend origin, without `/api` or a trailing slash. Vite embeds this value at build time, so redeploy after changing it; never put secrets in `VITE_` variables. The deployments do not link to each other. A fork can be imported if you cannot connect the original repository; sync the fork to receive upstream updates.

The Render backend must use production settings, but authentication is unavailable until real email OTP is implemented. Do not expose the console email service publicly.

## PostgreSQL database

PostgreSQL is the backend's only application database for questions, reports, homepage hero content, student study plans, custom mock attempts and personal flashcards. Install PostgreSQL, create an appropriately restricted database and user, and set `DATABASE_URL` in `backend/.env` without committing credentials. From `backend`, run `node --import tsx scripts/migrate-postgres.ts` to apply the SQL migrations. The backend requires the connection and all required tables at startup. Real PostgreSQL migration, locking, concurrency and backup/restore behavior still need operational verification.

For a remote PostgreSQL server with a private CA, obtain the CA certificate through your provider's trusted console and add `sslmode=verify-full` and `sslrootcert` (the URL-encoded local certificate path) to `DATABASE_URL`. This verifies both the certificate chain and server hostname for the backend and migration script. Do not disable certificate verification.

### Render backend

Set the service root directory to `backend`, the build command to `npm ci --include=dev && npm run build`, and the start command to `npm start`. The build installs the lockfile's compiler and produces `dist/server.js`; startup runs the compiled code. Render supplies `PORT`; set `HOST=0.0.0.0`, `NODE_ENV=production`, `DUMMY_OTP_ENABLED=false`, `ADMIN_PASSWORD`, `ADMIN_EMAIL`, `SESSION_SECRET` and `DATABASE_URL` in the service's environment settings. Both sign-in flows are unavailable until real email OTP delivery and verification are implemented.

Add the provider's CA certificate as a Render secret file named `ca.pem`, and set the connection URL's query string to `sslmode=verify-full&sslrootcert=%2Fetc%2Fsecrets%2Fca.pem`. Supply the database username, password, host, port and database name separately in the URL, with credentials URL-encoded where necessary. Never use a Windows certificate path on Render or commit credentials. Apply the PostgreSQL migrations before starting the service; the backend checks the required tables at startup.

## Practice and administration

Students can browse chapters with published questions at `/study/library`, answer questions at `/practice`, view explanations, and report errors. These study screens require student sign-in, and practice API requests require the student session. The latest answer and feedback for each question are saved per student and restored when its question version still matches; students can retry it. Student sign-in or sign-up is at `/sign-in` and creates an email-only account and temporary session. Sign in at `/admin` with the configured password and a console verification code to create, edit, publish, filter and import individual questions and review reports. Edits use version checks; a report retains the question text and version at the time it was submitted.

The chapter catalog is at `/course`, study tools at `/tools`, and the student dashboard at `/app`. Only the landing and sign-in pages are public; student study pages require a verified session. The planner at `/tools/planner` proposes one editable task per published practice chapter, evenly spaced across selected weekdays to a target date. Signed-in students can save tasks, completion and their available days/hours with optimistic revision checks; the dashboard shows their upcoming tasks. This basic proposal does not use approved topic weights. Since student sign-in is development-only, these are not secure production accounts.

Students can create timed custom mocks at `/app/mocks`, resume saved attempts, review submitted answers at `/app/results`, and see incorrect answers at `/app/mistakes`, with links to retest currently published questions. Mistakes combine the latest practice answer per question with submitted answers among the latest 100 custom mocks. A later correct answer clears a mistake; when answers have the same millisecond timestamp, an incorrect answer takes precedence. `/app/flashcards` supports personal cards and scheduled reviews, not approved shared decks. Daily and grand mocks, rankings and comprehensive analytics are not implemented. The admin dashboard and reports screen show question and report counts and submitted question reports, not the full planned administrative suite.

With PostgreSQL configured, `/admin/content/hero` lets an admin edit text and internal CTA paths, preview the draft at three sizes, publish it, and restore previously published revisions. The public homepage reads only the published revision and displays an unavailable state until one exists. Image uploads, external CTA approval, full CMS content, SSR, and durable staff identities/permissions are not yet implemented.

Chapter notes are an opt-in development feature. Apply the PostgreSQL migrations, set `CHAPTER_NOTES_ENABLED=true` on the backend and `VITE_CHAPTER_NOTES_ENABLED=true` for both frontend builds, then restart or rebuild as appropriate. At `/admin/content/chapters`, an admin can create plain-text sections, save revisions, publish a draft and restore a recorded publication as a new revision. Migration 009 records only the publication current at migration time; earlier publication history cannot be reconstructed, and its original publication time is unavailable. Signed-in students can read published notes through the chapter library, save their last-read section per account and continue from the dashboard. Drafts are not visible to students; stale chapter and progress writes return 409. Content must be approved before publication. Notes, permissions, audit and session security are not production-ready; the flag does not enable production sign-in. When the backend flag is off, chapter-note endpoints return 503 and existing practice remains available.

The prototype hero API is `GET /api/public/site/hero`, `GET /api/admin/site/hero`, `PUT /api/admin/site/hero/draft`, and `POST /api/admin/site/hero/publish` or `/restore`. Draft writes include `expectedRevision` and `content`; publish includes `expectedRevision`; restore includes `expectedRevision` and `sourceRevision`. A stale revision returns 409. Responses are `no-store`; public reads return 404 until published and 503 without PostgreSQL.

Import CSV files up to 100 KB with one question per row (1–1000 rows) and the header `chapter,published,stem,option_a,option_b,option_c,option_d,correct,explanation,source`. The `source` column is optional. Use `true` or `false` for published and A, B, C or D for correct. Quote fields containing commas, quotes or newlines using standard CSV quoting. Import adds new questions.

To add optional sample questions, start the backend in development mode and run `node --import tsx seed/seed.ts` from `backend` in an interactive terminal with `ADMIN_PASSWORD` and `ADMIN_EMAIL` configured. Enter the code printed in the backend console when prompted. Existing questions with matching chapter and stem are retained. The sample questions are for practice and are not an official or independently reviewed examination resource.

## Database upgrades

Back up PostgreSQL before applying schema changes. Apply migration 010 before deploying this backend version, then deploy the backend before the frontend that uses practice-answer restoration. The backend applies only the versioned SQL migrations in `backend/migrations`; transferring data from another database is a separate, explicit operation and is not performed automatically.

## Build and checks

Run `npm run build` in both `student-frontend` and `admin-frontend`, and `npm run build` and `npm test` in `backend`. Serve each frontend build with an `index.html` fallback and use a same-origin `/api` proxy or set `VITE_API_URL` when building. The current prototype must not be deployed as production authentication.

## Android prototype

In `royalprep-android`, run `npm ci` and `npm start`; in another terminal run `npm run android` with an Android emulator or device. For the emulator, the default development backend origin is `http://10.0.2.2:4000`; the backend must be running on the host with development demo OTP enabled. A physical device needs a reachable backend origin and appropriate network binding. HTTP origins are permitted only in development; release builds require HTTPS. The app supports demo OTP, a published chapter list and practice answers, explanations and reports. Other native workflows are not implemented. Sessions are held in memory and are lost when the app closes. `FLAG_SECURE` is enabled for the activity, but screen protection, interruptions and device behavior have not been verified on a device.

This is not a production app: the backend has no production student authentication, refresh or secure session restoration. Release signing is not configured; do not distribute a debug build or treat an unsigned release build as a signed deliverable. Run `npx tsc --noEmit`, `npm test -- --runInBand` and `npm run lint` for the native prototype.
