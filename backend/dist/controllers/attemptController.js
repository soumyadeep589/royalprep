import { createHash, randomInt, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { answerMutationSchema, attemptView, flagMutationSchema, startAttemptSchema, submitSchema } from '../models/attempt.js';
import { AttemptNotFound } from '../repositories/attemptRepository.js';
export function createAttemptController(repository, questions, practice) {
    const owner = (res) => res.locals.student.email;
    const expire = (attempt, now) => {
        if (attempt.status === 'active' && now >= attempt.deadline) {
            attempt.status = 'submitted';
            attempt.submittedAt = attempt.deadline;
            attempt.version++;
        }
    };
    async function mutate(res, id, change) {
        if (!z.string().uuid().safeParse(id).success) {
            res.status(404).json({ error: 'Mock attempt not found.' });
            return;
        }
        try {
            const result = await repository.mutate(owner(res), String(id), (attempt, now) => {
                expire(attempt, now);
                return change(attempt, now);
            });
            res.status(result.status).json(result.body);
        }
        catch (error) {
            if (error instanceof AttemptNotFound) {
                res.status(404).json({ error: 'Mock attempt not found.' });
                return;
            }
            throw error;
        }
    }
    const start = async (req, res) => {
        const parsed = startAttemptSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(422).json({ error: 'Choose valid chapters, question count and duration.' });
            return;
        }
        const { requestId, count, durationMinutes } = parsed.data;
        const chapters = [...parsed.data.chapters].sort();
        const fingerprint = createHash('sha256').update(JSON.stringify({ chapters, count, durationMinutes })).digest('hex');
        const existing = await repository.findRequest(owner(res), requestId);
        if (existing) {
            if (existing.fingerprint !== fingerprint) {
                res.status(409).json({ error: 'This request ID was already used for a different mock.' });
                return;
            }
            await mutate(res, existing.id, (attempt, now) => ({ status: 200, body: attemptView(attempt, now) }));
            return;
        }
        const available = (await questions.listQuestions(true)).filter(question => chapters.includes(question.chapter));
        if (count > available.length) {
            res.status(422).json({ error: `Only ${available.length} published questions are available for the selected chapters.` });
            return;
        }
        for (let i = available.length - 1; i > 0; i--) {
            const j = randomInt(i + 1);
            [available[i], available[j]] = [available[j], available[i]];
        }
        const now = Date.now();
        const attempt = {
            id: randomUUID(), requestId, fingerprint, version: 1, status: 'active', createdAt: now,
            deadline: now + durationMinutes * 60_000, submittedAt: null, questions: available.slice(0, count), answers: {}, flags: [],
        };
        if (!await repository.insert(owner(res), attempt)) {
            const duplicate = await repository.findRequest(owner(res), requestId);
            if (!duplicate || duplicate.fingerprint !== fingerprint) {
                res.status(409).json({ error: 'This request ID was already used for a different mock.' });
                return;
            }
            await mutate(res, duplicate.id, (current, time) => ({ status: 200, body: attemptView(current, time) }));
            return;
        }
        res.status(201).json(attemptView(attempt, Date.now()));
    };
    const get = async (req, res) => {
        await mutate(res, req.params.id, (attempt, now) => ({ status: 200, body: attemptView(attempt, now) }));
    };
    const list = async (_req, res) => {
        const ids = await repository.ids(owner(res));
        const items = await Promise.all(ids.map(id => repository.mutate(owner(res), id, (attempt, now) => {
            expire(attempt, now);
            const score = attempt.status === 'submitted' ? attempt.questions.filter(q => attempt.answers[q.id] === q.correct).length : null;
            return { id: attempt.id, status: attempt.status, createdAt: attempt.createdAt, deadline: attempt.deadline, submittedAt: attempt.submittedAt, count: attempt.questions.length, score };
        })));
        res.json(items.sort((a, b) => b.createdAt - a.createdAt));
    };
    const mistakes = async (_req, res) => {
        const ids = await repository.ids(owner(res));
        const attempts = await Promise.all(ids.map(id => repository.mutate(owner(res), id, (attempt, now) => {
            expire(attempt, now);
            return attempt;
        })));
        const candidates = (await practice.list(owner(res))).map(answer => ({ questionId: answer.questionId, chapter: answer.chapter, stem: answer.stem, attemptId: null, submittedAt: answer.answeredAt, isCorrect: answer.isCorrect }));
        for (const attempt of attempts.filter(value => value.status === 'submitted')) {
            if (attempt.submittedAt === null)
                continue;
            for (const question of attempt.questions) {
                const answer = attempt.answers[question.id];
                if (answer === undefined)
                    continue;
                candidates.push({ questionId: question.id, chapter: question.chapter, stem: question.stem, attemptId: attempt.id, submittedAt: attempt.submittedAt, isCorrect: answer === question.correct });
            }
        }
        candidates.sort((a, b) => b.submittedAt - a.submittedAt || Number(a.isCorrect) - Number(b.isCorrect));
        const seen = new Set();
        const items = candidates.filter(item => {
            if (seen.has(item.questionId))
                return false;
            seen.add(item.questionId);
            return !item.isCorrect;
        }).map(({ isCorrect: _isCorrect, ...item }) => item);
        res.json(items);
    };
    const answer = async (req, res) => {
        const input = answerMutationSchema.safeParse(req.body);
        if (!input.success) {
            res.status(422).json({ error: 'Provide a valid answer and current version.' });
            return;
        }
        await mutate(res, req.params.id, (attempt, now) => {
            if (attempt.status !== 'active')
                return { status: 409, body: { error: 'This mock has ended. Reload to review your result.' } };
            if (attempt.version !== input.data.expectedVersion)
                return { status: 409, body: { error: 'This mock changed elsewhere. Reload before saving.' } };
            const id = String(req.params.questionId);
            if (!attempt.questions.some(question => question.id === id))
                return { status: 404, body: { error: 'Question not found in this mock.' } };
            if (input.data.option === null)
                delete attempt.answers[id];
            else
                attempt.answers[id] = input.data.option;
            attempt.version++;
            return { status: 200, body: attemptView(attempt, now) };
        });
    };
    const flag = async (req, res) => {
        const input = flagMutationSchema.safeParse(req.body);
        if (!input.success) {
            res.status(422).json({ error: 'Provide a valid flag and current version.' });
            return;
        }
        await mutate(res, req.params.id, (attempt, now) => {
            if (attempt.status !== 'active')
                return { status: 409, body: { error: 'This mock has ended. Reload to review your result.' } };
            if (attempt.version !== input.data.expectedVersion)
                return { status: 409, body: { error: 'This mock changed elsewhere. Reload before saving.' } };
            const id = String(req.params.questionId);
            if (!attempt.questions.some(question => question.id === id))
                return { status: 404, body: { error: 'Question not found in this mock.' } };
            attempt.flags = attempt.flags.filter(value => value !== id);
            if (input.data.flagged)
                attempt.flags.push(id);
            attempt.version++;
            return { status: 200, body: attemptView(attempt, now) };
        });
    };
    const submit = async (req, res) => {
        const input = submitSchema.safeParse(req.body);
        if (!input.success) {
            res.status(422).json({ error: 'Provide the current mock version.' });
            return;
        }
        await mutate(res, req.params.id, (attempt, now) => {
            if (attempt.status === 'submitted')
                return { status: 200, body: attemptView(attempt, now) };
            if (attempt.version !== input.data.expectedVersion)
                return { status: 409, body: { error: 'This mock changed elsewhere. Reload before submitting.' } };
            attempt.status = 'submitted';
            attempt.submittedAt = now;
            attempt.version++;
            return { status: 200, body: attemptView(attempt, now) };
        });
    };
    return { list, mistakes, start, get, answer, flag, submit };
}
