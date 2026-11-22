import { z } from 'zod';
import { chapterContentSchema, chapterDraftSchema, chapterProgressSchema, chapterPublishSchema, chapterRestoreSchema } from '../models/chapter.js';
import { ChapterConflict, ChapterNotFound } from '../repositories/chapterRepository.js';
export function createChapterController(repository) {
    const idSchema = z.string().uuid();
    function guarded(handler) {
        return async (req, res, next) => {
            try {
                await handler(req, res, next);
            }
            catch (error) {
                if (error instanceof ChapterConflict) {
                    res.status(409).json({ error: error.message });
                    return;
                }
                if (error instanceof ChapterNotFound) {
                    res.status(404).json({ error: error.message });
                    return;
                }
                next(error);
            }
        };
    }
    const listAdmin = async (_req, res) => { res.json(await repository.listAdmin()); };
    const listStudent = async (_req, res) => {
        const student = res.locals.student;
        res.json(await repository.listPublished(student.email));
    };
    const getAdmin = async (req, res) => {
        const id = idSchema.safeParse(req.params.id);
        if (!id.success) {
            res.status(404).json({ error: 'Chapter not found.' });
            return;
        }
        const chapter = await repository.adminChapter(id.data);
        if (!chapter) {
            res.status(404).json({ error: 'Chapter not found.' });
            return;
        }
        res.json(chapter);
    };
    const create = async (req, res) => {
        const input = chapterContentSchema.safeParse(req.body);
        if (!input.success) {
            res.status(422).json({ error: 'Provide a title and valid, uniquely identified sections.' });
            return;
        }
        res.status(201).json({ id: await repository.create(input.data) });
    };
    const saveDraft = guarded(async (req, res) => {
        const id = idSchema.safeParse(req.params.id);
        if (!id.success) {
            res.status(404).json({ error: 'Chapter not found.' });
            return;
        }
        const input = chapterDraftSchema.safeParse(req.body);
        if (!input.success) {
            res.status(422).json({ error: 'Provide a current revision and valid, uniquely identified sections.' });
            return;
        }
        res.json({ revision: await repository.saveDraft(id.data, input.data.expectedRevision, input.data.content) });
    });
    const publish = guarded(async (req, res) => {
        const id = idSchema.safeParse(req.params.id);
        if (!id.success) {
            res.status(404).json({ error: 'Chapter not found.' });
            return;
        }
        const input = chapterPublishSchema.safeParse(req.body);
        if (!input.success) {
            res.status(422).json({ error: 'Provide the current chapter revision.' });
            return;
        }
        res.json({ revision: await repository.publish(id.data, input.data.expectedRevision) });
    });
    const restore = guarded(async (req, res) => {
        const id = idSchema.safeParse(req.params.id);
        if (!id.success) {
            res.status(404).json({ error: 'Chapter not found.' });
            return;
        }
        const input = chapterRestoreSchema.safeParse(req.body);
        if (!input.success) {
            res.status(422).json({ error: 'Provide the current and source revisions.' });
            return;
        }
        res.json({ revision: await repository.restore(id.data, input.data.expectedRevision, input.data.sourceRevision) });
    });
    const readStudent = async (req, res) => {
        const id = idSchema.safeParse(req.params.id);
        if (!id.success) {
            res.status(404).json({ error: 'Chapter not found.' });
            return;
        }
        const content = await repository.readPublished(id.data);
        if (!content) {
            res.status(404).json({ error: 'Published chapter not found.' });
            return;
        }
        const student = res.locals.student;
        const progress = await repository.readProgress(student.email, id.data);
        res.json({ id: id.data, ...content, progress: progress ?? null });
    };
    const saveProgress = guarded(async (req, res) => {
        const id = idSchema.safeParse(req.params.id);
        if (!id.success) {
            res.status(404).json({ error: 'Chapter not found.' });
            return;
        }
        const input = chapterProgressSchema.safeParse(req.body);
        if (!input.success) {
            res.status(422).json({ error: 'Provide a valid section, chapter revision and progress version.' });
            return;
        }
        const student = res.locals.student;
        res.json(await repository.writeProgress(student.email, id.data, input.data.expectedVersion, input.data.revision, input.data.sectionId));
    });
    return { listAdmin, listStudent, getAdmin, create, saveDraft, publish, restore, readStudent, saveProgress };
}
