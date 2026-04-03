import { Request, Response } from 'express';
import Course from '../models/Course';
import { generateEmbedding } from '../services/gemini.service';
import { VectorService } from '../services/vector.service';
import { sendSuccess, sendError } from '../utils/response';

/**
 * Normalize a skill string for matching.
 * "React.js" → "reactjs", "Node JS" → "nodejs", "C++" → "c++"
 */
function normalizeSkill(s: string): string {
    return s.toLowerCase().replace(/[.\-\s]/g, '');
}

/**
 * Check if two skill strings match (handles variants).
 */
function skillsMatch(a: string, b: string): boolean {
    const na = normalizeSkill(a);
    const nb = normalizeSkill(b);
    return na === nb || na.includes(nb) || nb.includes(na);
}

/**
 * POST /api/courses/recommend
 * Body: { skills: string[], limit?: number }
 *
 * Per-skill matching: finds the best course for EACH skill, then returns them.
 */
export const recommendCourses = async (req: Request, res: Response) => {
    try {
        const { skills, limit = 2 } = req.body;

        if (!skills || !Array.isArray(skills) || skills.length === 0) {
            return sendError(res, 400, 'skills array is required');
        }

        const courses = await Course.find({ active: true }).select('+skillsEmbedding');
        const results: any[] = [];
        const usedIds = new Set<string>();

        for (const skill of skills) {
            const skillEmbedding = await generateEmbedding(skill);
            const skillLower = skill.toLowerCase();

            const scored = courses
                .filter(c => !usedIds.has(c._id.toString()))
                .map((course) => {
                    let score = 0;
                    const courseSkillsLower = course.skills.map((s: string) => s.toLowerCase());
                    const titleLower = course.title.toLowerCase();
                    const descLower = (course.description || '').toLowerCase();

                    // Direct skill match (strongest)
                    if (courseSkillsLower.some((cs: string) => skillsMatch(cs, skillLower))) score += 0.45;
                    // Title contains skill
                    if (titleLower.includes(skillLower) || skillLower.split(' ').every((w: string) => titleLower.includes(w))) score += 0.25;
                    // Description contains skill
                    if (descLower.includes(skillLower)) score += 0.05;
                    // Semantic similarity
                    if (skillEmbedding && course.skillsEmbedding?.length) {
                        score += Math.max(0, VectorService.cosineSimilarity(skillEmbedding, course.skillsEmbedding)) * 0.20;
                    }
                    score += (course.isFree ? 0.03 : 0) + (course.level === 'Beginner' ? 0.02 : 0.01);

                    return { course, score };
                })
                .filter(x => x.score > 0.15)
                .sort((a, b) => b.score - a.score)
                .slice(0, limit);

            for (const { course, score } of scored) {
                usedIds.add(course._id.toString());
                results.push({
                    _id: course._id,
                    title: course.title,
                    provider: course.provider,
                    url: course.url,
                    skills: course.skills,
                    duration: course.duration,
                    level: course.level,
                    language: course.language,
                    isFree: course.isFree,
                    institution: course.institution,
                    description: course.description,
                    score: Math.round(score * 100) / 100,
                    matchedSkills: [skill],
                });
            }
        }

        const topCourses = results;

        return sendSuccess(res, topCourses, 'Course recommendations generated');
    } catch (error) {
        console.error('Course Recommendation Error:', error);
        return sendError(res, 500, 'Failed to generate course recommendations');
    }
};

/**
 * POST /api/courses/recommend-by-skill
 * Body: { skill: string, limit?: number }
 *
 * Returns top courses for a single skill. Used by the skill-gap feature
 * to get per-skill recommendations.
 */
export const recommendBySkill = async (req: Request, res: Response) => {
    try {
        const { skill, limit = 3 } = req.body;

        if (!skill || typeof skill !== 'string') {
            return sendError(res, 400, 'skill string is required');
        }

        const queryEmbedding = await generateEmbedding(skill);
        const courses = await Course.find({ active: true }).select('+skillsEmbedding');

        const scored = courses.map((course) => {
            let score = 0;

            if (queryEmbedding && course.skillsEmbedding && course.skillsEmbedding.length > 0) {
                score += Math.max(0, VectorService.cosineSimilarity(queryEmbedding, course.skillsEmbedding)) * 0.60;
            }

            const skillLower = skill.toLowerCase();
            const hasDirectMatch = course.skills.some((s: string) => {
                const sl = s.toLowerCase();
                return sl.includes(skillLower) || skillLower.includes(sl);
            });
            score += (hasDirectMatch ? 1 : 0) * 0.30;

            score += (course.isFree ? 1 : 0) * 0.05;
            score += (course.level === 'Beginner' ? 1 : 0.5) * 0.05;

            return {
                title: course.title,
                provider: course.provider,
                url: course.url,
                duration: course.duration,
                level: course.level,
                institution: course.institution,
                description: course.description,
                score,
            };
        });

        scored.sort((a, b) => b.score - a.score);

        return sendSuccess(res, scored.slice(0, limit), `Top courses for "${skill}"`);
    } catch (error) {
        console.error('Recommend by Skill Error:', error);
        return sendError(res, 500, 'Failed to fetch course recommendations');
    }
};

/**
 * GET /api/courses
 * Query: ?provider=NPTEL&skill=Python
 * Lists all courses with optional filters.
 */
export const listCourses = async (req: Request, res: Response) => {
    try {
        const { provider, skill } = req.query;

        const filter: Record<string, unknown> = { active: true };
        if (provider) filter.provider = provider;
        if (skill) filter.skills = { $regex: new RegExp(String(skill), 'i') };

        const courses = await Course.find(filter).sort({ createdAt: -1 });

        return sendSuccess(res, courses, 'Courses fetched');
    } catch (error) {
        console.error('List Courses Error:', error);
        return sendError(res, 500, 'Failed to fetch courses');
    }
};
