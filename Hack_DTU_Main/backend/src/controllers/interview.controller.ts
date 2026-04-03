import { Request, Response } from 'express';
import axios from 'axios';
import Interview from '../models/Interview';
import InterviewFeedback from '../models/InterviewFeedback';
import { sendSuccess, sendError, sendCreated } from '../utils/response';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma3:4b';

export const generateInterview = async (req: Request, res: Response) => {
    try {
        const userId = req.user?._id;
        if (!userId) return sendError(res, 401, 'Unauthorized');

        const { profileData } = req.body;
        if (!profileData) {
            return sendError(res, 400, 'Profile data is required');
        }

        const { skills = [], experience = [], education = [], bio = '', targetRole = '', language = 'en' } = profileData;

        if (!targetRole) {
            return sendError(res, 400, 'Target role is required');
        }

        const LANG_NAMES: Record<string, string> = { en: 'English', hi: 'Hindi (Hinglish is fine)', mr: 'Marathi' };
        const langName = LANG_NAMES[language] || 'English';

        // Determine interview type and level based on experience
        const type = 'Mixed';
        const level = experience.length >= 5
            ? 'Senior'
            : experience.length >= 2
                ? 'Mid-level'
                : 'Junior';

        const questionCount = 10;

        const langInstruction = language !== 'en'
            ? `\n\nIMPORTANT: Generate ALL questions in ${langName}. Technical terms (React, API, SQL, etc.) can stay in English, but the question text must be in ${langName}.`
            : '';

        const prompt = `You are an expert interview coach. Generate ${questionCount} interview questions for a candidate with this profile:

Role: ${targetRole}
Skills: ${Array.isArray(skills) ? skills.join(', ') : skills}
Experience: ${Array.isArray(experience) ? experience.map((e: any) => `${e.role} at ${e.company}`).join(', ') : experience}
Education: ${Array.isArray(education) ? education.map((e: any) => `${e.degree} from ${e.institution}`).join(', ') : education}
Bio: ${bio}

Interview type: ${type} (Technical/Behavioral/Mixed)

Generate questions that:
1. Test the candidate's claimed skills with depth
2. Explore their past experience with behavioral questions
3. Include at least 2 role-specific technical questions
4. Start with an icebreaker and end with "Do you have any questions?"
${langInstruction}
Return ONLY a JSON array of question strings, no other text.`;

        const ollamaRes = await axios.post(`${OLLAMA_URL}/api/chat`, {
            model: OLLAMA_MODEL,
            messages: [{ role: 'user', content: prompt }],
            stream: false,
        }, { timeout: 120000 });
        const responseText = ollamaRes.data.message?.content || '';

        // Parse the JSON array from the response
        let questions: string[];
        try {
            // Remove markdown code fences if present
            const cleaned = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            questions = JSON.parse(cleaned);
        } catch (parseError) {
            console.error('Failed to parse LLM response:', responseText);
            return sendError(res, 500, 'Failed to parse generated questions');
        }

        if (!Array.isArray(questions) || questions.length === 0) {
            return sendError(res, 500, 'No questions were generated');
        }

        // Determine techstack from skills
        const techstack = Array.isArray(skills) ? skills.slice(0, 10) : [];

        // Save the interview to the database
        const interview = await Interview.create({
            role: targetRole,
            type,
            level,
            techstack,
            questions,
            userId: userId.toString(),
            targetRole,
            language: language || 'en',
        });

        return sendCreated(res, {
            interview: {
                id: interview._id,
                role: interview.role,
                type: interview.type,
                level: interview.level,
                techstack: interview.techstack,
                questions: interview.questions,
            },
        }, 'Interview generated successfully');

    } catch (error) {
        console.error('Generate Interview Error:', error);
        return sendError(res, 500, 'Failed to generate interview');
    }
};

export const getInterviews = async (req: Request, res: Response) => {
    try {
        const userId = req.user?._id;
        if (!userId) return sendError(res, 401, 'Unauthorized');

        const interviews = await Interview.find({ userId: userId.toString() }).sort({ createdAt: -1 });

        return sendSuccess(res, interviews, 'Interviews fetched successfully');
    } catch (error) {
        console.error('Get Interviews Error:', error);
        return sendError(res, 500, 'Failed to fetch interviews');
    }
};

export const getInterviewById = async (req: Request, res: Response) => {
    try {
        const userId = req.user?._id;
        if (!userId) return sendError(res, 401, 'Unauthorized');

        const { id } = req.params;
        const interview = await Interview.findOne({ _id: id, userId: userId.toString() });

        if (!interview) return sendError(res, 404, 'Interview not found');

        return sendSuccess(res, interview, 'Interview fetched successfully');
    } catch (error) {
        console.error('Get Interview By ID Error:', error);
        return sendError(res, 500, 'Failed to fetch interview');
    }
};

export const saveFeedback = async (req: Request, res: Response) => {
    try {
        const userId = req.user?._id;
        if (!userId) return sendError(res, 401, 'Unauthorized');

        const {
            interviewId,
            totalScore,
            categoryScores,
            strengths,
            areasForImprovement,
            finalAssessment,
            conversationHistory,
            proctoringSummary,
            terminated,
        } = req.body;

        if (!interviewId) {
            return sendError(res, 400, 'Interview ID is required');
        }

        // Verify the interview exists
        const interview = await Interview.findById(interviewId);
        if (!interview) {
            return sendError(res, 404, 'Interview not found');
        }

        // Check if feedback already exists for this interview+user
        const existingFeedback = await InterviewFeedback.findOne({
            interviewId,
            userId: userId.toString(),
        });

        if (existingFeedback) {
            // Update existing feedback
            existingFeedback.totalScore = totalScore;
            existingFeedback.categoryScores = categoryScores;
            existingFeedback.strengths = strengths;
            existingFeedback.areasForImprovement = areasForImprovement;
            existingFeedback.finalAssessment = finalAssessment;
            existingFeedback.conversationHistory = conversationHistory;
            if (proctoringSummary) (existingFeedback as any).proctoringSummary = proctoringSummary;
            if (terminated != null) (existingFeedback as any).terminated = terminated;
            await existingFeedback.save();

            return sendSuccess(res, existingFeedback, 'Feedback updated successfully');
        }

        // Create new feedback
        const feedback = await InterviewFeedback.create({
            interviewId,
            userId: userId.toString(),
            totalScore,
            categoryScores,
            strengths,
            areasForImprovement,
            finalAssessment,
            conversationHistory,
            ...(proctoringSummary ? { proctoringSummary } : {}),
            ...(terminated ? { terminated: true } : {}),
        });

        return sendCreated(res, feedback, 'Feedback saved successfully');
    } catch (error) {
        console.error('Save Feedback Error:', error);
        return sendError(res, 500, 'Failed to save feedback');
    }
};

export const getFeedback = async (req: Request, res: Response) => {
    try {
        const userId = req.user?._id;
        if (!userId) return sendError(res, 401, 'Unauthorized');

        const { id } = req.params;

        const feedback = await InterviewFeedback.findOne({
            interviewId: id,
            userId: userId.toString(),
        });

        if (!feedback) return sendError(res, 404, 'Feedback not found');

        return sendSuccess(res, feedback, 'Feedback fetched successfully');
    } catch (error) {
        console.error('Get Feedback Error:', error);
        return sendError(res, 500, 'Failed to fetch feedback');
    }
};

export const getMyFeedback = async (req: Request, res: Response) => {
    try {
        const userId = req.user?._id;
        if (!userId) return sendError(res, 401, 'Unauthorized');

        const feedbacks = await InterviewFeedback.find({ userId: userId.toString(), terminated: { $ne: true } }).sort({ createdAt: -1 });

        return sendSuccess(res, feedbacks, 'Feedback fetched successfully');
    } catch (error) {
        console.error('Get My Feedback Error:', error);
        return sendError(res, 500, 'Failed to fetch feedback');
    }
};
