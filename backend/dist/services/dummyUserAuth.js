import { randomBytes } from 'node:crypto';
import { normalizeEmail } from './email.js';
const challengeLifetime = 5 * 60_000;
const sessionLifetime = 8 * 60 * 60_000;
export function createDummyUserAuth(enabled, postgres, emailService) {
    const challenges = new Map();
    const sessions = new Map();
    const requestOtp = async (req, res) => {
        res.set('Cache-Control', 'no-store');
        if (!enabled) {
            res.status(503).json({ error: 'Student sign-in is unavailable.' });
            return;
        }
        const email = normalizeEmail(req.body?.email);
        if (!email) {
            res.status(422).json({ error: 'Enter a valid email address.' });
            return;
        }
        const now = Date.now();
        for (const [address, challenge] of challenges) {
            if (challenge.expiresAt <= now)
                challenges.delete(address);
        }
        const challenge = { expiresAt: now + challengeLifetime, code: emailService.generateCode(), attempts: 0 };
        challenges.set(email, challenge);
        try {
            await emailService.sendCode(email, challenge.code);
        }
        catch (error) {
            if (challenges.get(email) === challenge)
                challenges.delete(email);
            throw error;
        }
        res.json({ message: 'Your verification code is available in the server console.', expiresInSeconds: challengeLifetime / 1000 });
    };
    const verifyOtp = async (req, res) => {
        res.set('Cache-Control', 'no-store');
        if (!enabled) {
            res.status(503).json({ error: 'Student sign-in is unavailable.' });
            return;
        }
        const email = normalizeEmail(req.body?.email);
        const code = req.body?.code;
        if (!email || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
            res.status(422).json({ error: 'Enter a valid email address and six-digit code.' });
            return;
        }
        const challenge = challenges.get(email);
        if (!challenge || challenge.expiresAt <= Date.now()) {
            challenges.delete(email);
            res.status(401).json({ error: 'The code is missing or expired. Request a new code.' });
            return;
        }
        if (challenge.code !== code) {
            challenge.attempts++;
            if (challenge.attempts >= 5)
                challenges.delete(email);
            res.status(401).json({ error: 'Invalid verification code. Request a new code if needed.' });
            return;
        }
        challenges.delete(email);
        await postgres.query('INSERT INTO student_accounts (email) VALUES ($1) ON CONFLICT (email) DO NOTHING', [email]);
        const account = await postgres.query('SELECT deleted_at FROM student_accounts WHERE email = $1', [email]);
        if (!account.rows[0] || account.rows[0].deleted_at !== null) {
            res.status(403).json({ error: 'This account is unavailable.' });
            return;
        }
        const expiresAt = Date.now() + sessionLifetime;
        for (const [token, session] of sessions)
            if (session.expiresAt <= Date.now())
                sessions.delete(token);
        const token = randomBytes(32).toString('base64url');
        sessions.set(token, { email, expiresAt });
        res.json({ token, user: { email }, expiresAt });
    };
    const requireStudent = async (req, res, next) => {
        if (!enabled) {
            res.status(401).json({ error: 'Student sign-in is unavailable.' });
            return;
        }
        const token = req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
        const session = token ? sessions.get(token) : undefined;
        if (!token || !session || session.expiresAt <= Date.now()) {
            if (token)
                sessions.delete(token);
            res.status(401).json({ error: 'Sign in to your student account.' });
            return;
        }
        const account = await postgres.query('SELECT deleted_at FROM student_accounts WHERE email = $1', [session.email]);
        if (!account.rows[0] || account.rows[0].deleted_at !== null) {
            sessions.delete(token);
            res.status(401).json({ error: 'Sign in to your student account.' });
            return;
        }
        res.locals.student = session;
        res.locals.studentToken = token;
        next();
    };
    const getSession = (_req, res) => {
        const { email, expiresAt } = res.locals.student;
        res.json({ user: { email }, expiresAt });
    };
    const logout = (_req, res) => {
        sessions.delete(res.locals.studentToken);
        res.json({ message: 'Signed out.' });
    };
    const deleteAccount = async (req, res) => {
        if (req.body?.confirmation !== 'DELETE') {
            res.status(422).json({ error: 'Type DELETE to confirm account deactivation.' });
            return;
        }
        const { email } = res.locals.student;
        const result = await postgres.query('UPDATE student_accounts SET deleted_at = now() WHERE email = $1 AND deleted_at IS NULL RETURNING email', [email]);
        if (!result.rows.length) {
            res.status(401).json({ error: 'Sign in to your student account.' });
            return;
        }
        challenges.delete(email);
        for (const [token, session] of sessions)
            if (session.email === email)
                sessions.delete(token);
        res.json({ message: 'Your account has been deactivated. Your records are retained.' });
    };
    return { requestOtp, verifyOtp, requireStudent, getSession, logout, deleteAccount };
}
