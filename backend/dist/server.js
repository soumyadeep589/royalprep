import 'dotenv/config';
import pg from 'pg';
import { createApp } from './app.js';
const { ADMIN_PASSWORD, SESSION_SECRET, DATABASE_URL } = process.env;
if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12 || !SESSION_SECRET || SESSION_SECRET.length < 32) {
    throw Error('Set ADMIN_PASSWORD (12+ characters) and SESSION_SECRET (32+ characters) in .env.');
}
const dummyOtpEnabled = process.env.DUMMY_OTP_ENABLED === 'true';
const chapterNotesEnabled = process.env.CHAPTER_NOTES_ENABLED === 'true';
if (dummyOtpEnabled && process.env.NODE_ENV !== 'development') {
    throw Error('DUMMY_OTP_ENABLED is only allowed when NODE_ENV=development.');
}
if (!DATABASE_URL)
    throw Error('Set DATABASE_URL for PostgreSQL storage.');
const postgres = new pg.Pool({ connectionString: DATABASE_URL });
await postgres.query('SELECT 1 FROM questions LIMIT 0');
await postgres.query('SELECT 1 FROM question_reports LIMIT 0');
await postgres.query('SELECT 1 FROM hero_state LIMIT 0');
await postgres.query('SELECT 1 FROM student_study_plans LIMIT 0');
await postgres.query('SELECT 1 FROM custom_attempts LIMIT 0');
await postgres.query('SELECT 1 FROM student_flashcards LIMIT 0');
await postgres.query('SELECT deleted_at FROM student_accounts LIMIT 0');
await postgres.query('SELECT 1 FROM student_practice_answers LIMIT 0');
if (chapterNotesEnabled) {
    await postgres.query('SELECT 1 FROM chapter_documents LIMIT 0');
    await postgres.query('SELECT 1 FROM chapter_revisions LIMIT 0');
    await postgres.query('SELECT 1 FROM chapter_publications LIMIT 0');
    await postgres.query('SELECT 1 FROM student_chapter_progress LIMIT 0');
}
const app = createApp({ adminPassword: ADMIN_PASSWORD, secret: SESSION_SECRET, adminEmail: process.env.ADMIN_EMAIL, origin: process.env.FRONTEND_ORIGIN, dummyOtpEnabled, chapterNotesEnabled, postgres });
const port = Number(process.env.PORT ?? 4000);
const listening = () => console.log('RoyalPrep API listening on port ' + port);
const server = process.env.HOST ? app.listen(port, process.env.HOST, listening) : app.listen(port, listening);
async function stop() { server.close(async () => { await postgres.end(); process.exit(0); }); }
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
