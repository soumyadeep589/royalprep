import { z } from 'zod';
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
});
export const studyPlanSchema = z.object({
    targetDate: date,
    daysPerWeek: z.number().int().min(1).max(7),
    studyDays: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional(),
    hoursPerWeek: z.number().min(1).max(168),
    tasks: z.array(z.object({
        id: z.string().uuid(),
        chapter: z.string().trim().min(1).max(120),
        title: z.string().trim().min(1).max(200),
        dueDate: date,
        done: z.boolean(),
    }).strict()).max(500),
}).strict()
    .refine(plan => new Set(plan.tasks.map(task => task.id)).size === plan.tasks.length, 'Task IDs must be unique.')
    .refine(plan => !plan.studyDays || (new Set(plan.studyDays).size === plan.studyDays.length && plan.studyDays.length === plan.daysPerWeek), 'Study days must be unique and match days per week.');
