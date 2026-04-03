import { Request, Response } from 'express';
import { sendSuccess, sendError } from '../utils/response';
import axios from 'axios';
import Job from '../models/Job';
import JobSeekerProfile from '../models/JobSeekerProfile';
import Course from '../models/Course';
import { VectorService } from '../services/vector.service';
import { generateEmbedding } from '../services/gemini.service';

export const parseResumeWithAI = async (req: Request, res: Response) => {
    try {
        const { text } = req.body;
        if (!text || text.length < 50) {
            return sendError(res, 400, 'Insufficient resume text provided', 'INVALID_INPUT');
        }

        const apiKey = process.env.ONDEMAND_API_KEY;
        if (!apiKey) {
            console.error('OnDemand API Key missing from process.env');
            return sendError(res, 500, 'Server configuration error', 'CONFIG_ERROR');
        }

        const prompt = `
        You are a highly accurate Resume Parsing Agent.
        Your goal is to extract structured data from the resume text provided.

        CRITICAL RULES:
        1. Return ONLY valid JSON.
        2. "skills": Array of strings (Max 20).
        3. "experience" & "projects": 
           - Preserve exact bullet points from the text. 
           - Do NOT summarize or shorten descriptions. 
           - Keep the original formatting (newlines/bullets).
        4. "education": Extract the End Year as "year" (e.g. "2024").
        5. If a field is missing, use empty string "" or empty array [].

        SCHEMA:
        {
          "personalInfo": { "fullName": "", "email": "", "phone": "", "linkedin": "", "github": "", "bio": "" },
          "education": [{ "institution": "", "degree": "", "year": "2024", "score": "" }],
          "experience": [{ "role": "", "company": "", "duration": "", "description": "• Built X using Y..." }],
          "projects": [{ "title": "", "technologies": "", "link": "", "description": "• Implemented Z..." }],
          "skills": ["React", "TypeScript"]
        }

        RESUME TEXT:
        ${text.substring(0, 15000)}
        `;

        // Step 1: Create Chat Session
        const sessionResponse = await axios.post(
            'https://api.on-demand.io/chat/v1/sessions',
            {
                pluginIds: [],
                externalUserId: req.user?._id || 'guest'
            },
            {
                headers: { 'apikey': apiKey }
            }
        );

        const sessionId = sessionResponse.data?.data?.id;
        if (!sessionId) throw new Error("Failed to create chat session");

        // Step 2: Submit Query
        const queryResponse = await axios.post(
            `https://api.on-demand.io/chat/v1/sessions/${sessionId}/query`,
            {
                endpointId: 'predefined-openai-gpt4o',
                query: prompt,
                pluginIds: [],
                responseMode: 'sync'
            },
            {
                headers: {
                    'apikey': apiKey,
                    'Content-Type': 'application/json'
                }
            }
        );

        const aiResponse = queryResponse.data?.data?.answer || JSON.stringify(queryResponse.data);
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error("AI did not return JSON");
        }

        const parsedData = JSON.parse(jsonMatch[0]);

        return sendSuccess(res, parsedData, 'Resume parsed with OnDemand AI');

    } catch (error: any) {
        console.error('OnDemand Parsing Error:', error.response?.data || error.message);
        return sendError(res, 500, 'Failed to process resume with AI', 'AI_ERROR');
    }
};

export const analyzeSkillGap = async (req: Request, res: Response) => {
    try {
        const { jobId } = req.body;
        const userId = req.user?._id;

        if (!jobId) return sendError(res, 400, 'Job ID is required');

        // 1. Fetch Job and Profile Data WITH Embeddings for Consistent Scoring
        const job = await Job.findById(jobId).select('+skillsEmbedding +experienceEmbedding +descriptionEmbedding title description requirements skills');
        const profile = await JobSeekerProfile.findOne({ userId }).select('+skillsEmbedding +experienceEmbedding +bioEmbedding skills experience projects personalInfo');

        if (!job) return sendError(res, 404, 'Job not found');
        if (!profile) return sendError(res, 404, 'Job Seeker Profile not found. Please complete your profile.');

        const apiKey = process.env.ONDEMAND_API_KEY;
        if (!apiKey) return sendError(res, 500, 'Server Config Error: API Key Missing');

        // 2. CALCULATE "TRUTH" SCORE (Anchor)
        // This logic mirrors recommendation.controller.ts exactly
        let calculatedScore = 0;
        let scoreBreakdown = { skills: 0, experience: 0, role: 0 };
        let debugMsg = "Embeddings Missing";

        if (job.skillsEmbedding && profile.skillsEmbedding) {
            const exactSkillScore = VectorService.cosineSimilarity(profile.skillsEmbedding, job.skillsEmbedding);
            const expScore = (profile.experienceEmbedding && job.experienceEmbedding)
                ? VectorService.cosineSimilarity(profile.experienceEmbedding, job.experienceEmbedding) : 0;
            const roleScore = (profile.bioEmbedding && job.descriptionEmbedding)
                ? VectorService.cosineSimilarity(profile.bioEmbedding, job.descriptionEmbedding) : 0;

            // Weights: Skills (50%), Experience (30%), Role (20%)
            // Ensure non-negative
            const wSkill = Math.max(0, exactSkillScore);
            const wExp = Math.max(0, expScore);
            const wRole = Math.max(0, roleScore);

            calculatedScore = (wSkill * 0.5) + (wExp * 0.3) + (wRole * 0.2);

            scoreBreakdown = {
                skills: Math.round(wSkill * 100),
                experience: Math.round(wExp * 100),
                role: Math.round(wRole * 100)
            };
            debugMsg = "Calculated via Vectors";
        }

        const finalPercentage = Math.round(Math.max(0, calculatedScore * 100));


        // 3. Prepare Context for AI
        const jobContext = `
        JOB TITLE: ${job.title}
        DESCRIPTION: ${job.description}
        REQUIREMENTS: ${job.requirements ? job.requirements.join('; ') : ''}
        DESIRED SKILLS: ${job.skills ? job.skills.join(', ') : ''}
        `;

        const profileContext = `
        CANDIDATE SKILLS: ${profile.skills ? profile.skills.join(', ') : ''}
        EXPERIENCE: ${profile.experience ? profile.experience.map((e: any) => `${e.role} at ${e.company} (${e.duration}): ${e.description}`).join('\n') : ''}
        PROJECTS: ${profile.projects ? profile.projects.map((p: any) => `${p.title}: ${p.description} [${p.technologies}]`).join('\n') : ''}
        BIO: ${profile.personalInfo?.bio || ''}
        `;

        // 4. Construct Prompt (ANCHORED MODE)
        const prompt = `
        You are a Technical Recruiter analyzing a candidate.
        
        SYSTEM DATA (TRUTH):
        The internal algorithm has calculated a verified Match Score of: **${finalPercentage}%**.
        Breakdown: Skills Match: ${scoreBreakdown.skills}%, Experience Match: ${scoreBreakdown.experience}%, Role/Bio Match: ${scoreBreakdown.role}%.

        YOUR TASK:
        1. **Accept the ${finalPercentage}% score as the absolute truth.** Do not calculate your own score.
        2. Explain WHY the score is ${finalPercentage}% (and not 100%).
        3. Identify the specific gaps (Missing Skills, Experience Mismatch, etc.) that account for the missing ${100 - finalPercentage}%.

        JOB DETAILS:
        ${jobContext.substring(0, 3000)}

        CANDIDATE PROFILE:
        ${profileContext.substring(0, 3000)}

        OUTPUT SCHEMA (JSON ONLY):
        {
          "score": ${finalPercentage},
          "analysis": "Two sentence summary explaining the ${finalPercentage}% fit.",
          "gapReasoning": "Explain the missing ${100 - finalPercentage}% (e.g. 'The system deducted points for lack of specific React experience...').",
          "missingSkills": [
             { "name": "Skill Name", "category": "Framework/Tool", "importance": "High/Medium" }
          ]
        }

        IMPORTANT: Do NOT include learningPath in your response. Course recommendations are handled separately.
        `;

        // 5. Call OnDemand AI
        const sessionRes = await axios.post('https://api.on-demand.io/chat/v1/sessions',
            { externalUserId: userId, pluginIds: [] },
            { headers: { apikey: apiKey } }
        );
        const sessionId = sessionRes.data?.data?.id;

        const queryRes = await axios.post(`https://api.on-demand.io/chat/v1/sessions/${sessionId}/query`,
            {
                endpointId: 'predefined-openai-gpt4o',
                query: prompt,
                responseMode: 'sync'
            },
            { headers: { apikey: apiKey } }
        );

        const aiText = queryRes.data?.data?.answer;
        const jsonMatch = aiText.match(/\{[\s\S]*\}/);

        if (!jsonMatch) {
            console.error("AI Response:", aiText); // Debug
            return sendError(res, 500, 'AI failed to generate structural analysis');
        }

        const data = JSON.parse(jsonMatch[0]);
        // Force override score just in case AI disobeyed
        data.score = finalPercentage;

        // 6. Fetch real course recommendations — KEYWORD-FIRST per-skill matching
        // Embeddings are unreliable (stale, low scores). Use text search across tags + title + description.
        const missingSkills: { name: string; importance: string }[] = data.missingSkills || [];

        if (missingSkills.length > 0) {
            try {
                const allCourses = await Course.find({ active: true });
                const recommendations: any[] = [];
                const usedCourseIds = new Set<string>();

                for (const skill of missingSkills) {
                    const skillName = skill.name;
                    const skillLower = skillName.toLowerCase().trim();
                    const skillNorm = skillLower.replace(/[.\-\s\/]/g, '');
                    // Individual words for fuzzy matching (filter out tiny words)
                    const skillWords = skillLower.split(/[\s\-\/]+/).filter((w: string) => w.length > 2);

                    let bestCourse: any = null;
                    let bestScore = 0;
                    let bestReasons: string[] = [];

                    for (const course of allCourses) {
                        const courseId = course._id.toString();
                        if (usedCourseIds.has(courseId)) continue;

                        let score = 0;
                        const reasons: string[] = [];

                        const titleLower = course.title.toLowerCase();
                        const descLower = (course.description || '').toLowerCase();
                        // Combine ALL searchable text
                        const allText = [
                            titleLower,
                            descLower,
                            course.skills.join(' ').toLowerCase(),
                            (course.skillsText || '').toLowerCase(),
                        ].join(' ');

                        // --- Signal 1: Exact skill name in tags (strongest) ---
                        const tagMatch = course.skills.find((t: string) => {
                            const tNorm = t.toLowerCase().replace(/[.\-\s\/]/g, '');
                            return tNorm === skillNorm || t.toLowerCase() === skillLower;
                        });
                        if (tagMatch) {
                            score += 50;
                            reasons.push(`Course is tagged with "${tagMatch}"`);
                        }

                        // --- Signal 2: Full skill phrase in title ---
                        if (titleLower.includes(skillLower)) {
                            score += 40;
                            reasons.push(`"${skillName}" found in course title`);
                        }

                        // --- Signal 3: Full skill phrase in description or skillsText ---
                        if (descLower.includes(skillLower) || (course.skillsText || '').toLowerCase().includes(skillLower)) {
                            score += 15;
                            reasons.push(`"${skillName}" mentioned in course content`);
                        }

                        // --- Signal 4: Individual word matches (for multi-word skills) ---
                        // e.g., "CI/CD Pipeline Management" → check "pipeline", "management", "ci/cd"
                        if (score === 0 && skillWords.length > 0) {
                            const wordHits = skillWords.filter((w: string) => allText.includes(w));
                            const wordRatio = wordHits.length / skillWords.length;
                            if (wordRatio >= 0.5 && wordHits.length >= 2) {
                                // At least half the words match — but ONLY for multi-word skills
                                // and require at least 2 word matches to avoid "management" alone matching
                                score += Math.round(wordRatio * 20);
                                reasons.push(`Contains related terms: ${wordHits.join(', ')}`);
                            }
                        }

                        // --- Signal 5: Small bonuses ---
                        if (score > 0) {
                            score += (course.isFree ? 2 : 0);
                            score += (course.level === 'Beginner' ? 1 : 0);
                        }

                        if (score > bestScore) {
                            bestScore = score;
                            bestReasons = reasons;
                            bestCourse = course;
                        }
                    }

                    // Only recommend if score >= 15 (at least a description/content match)
                    if (bestCourse && bestScore >= 15) {
                        usedCourseIds.add(bestCourse._id.toString());

                        const reasonParts = [`Recommended for your "${skillName}" gap`];
                        if (bestReasons.length > 0) reasonParts.push(bestReasons.join('. '));
                        if (bestCourse.institution) reasonParts.push(`by ${bestCourse.institution}`);

                        recommendations.push({
                            title: bestCourse.title,
                            description: bestCourse.description,
                            link: bestCourse.url,
                            provider: bestCourse.provider,
                            duration: bestCourse.duration,
                            level: bestCourse.level,
                            institution: bestCourse.institution,
                            isFree: bestCourse.isFree,
                            matchedSkills: [skillName],
                            score: bestScore,
                            reason: reasonParts.join(' — '),
                            matchScore: Math.min(100, bestScore),
                        });
                    }
                    // If score < 15 → no recommendation for this skill (shown in "uncovered" section)
                }

                // 7. FALLBACK: For uncovered skills, search Udemy via OnDemand agent tool
                const coveredSkills = new Set(recommendations.map((r: any) => r.matchedSkills[0]?.toLowerCase()));
                const uncoveredSkills = missingSkills
                    .filter(s => !coveredSkills.has(s.name.toLowerCase()))
                    .map(s => s.name);

                if (uncoveredSkills.length > 0 && apiKey) {
                    try {
                        console.log('[SkillGap] Searching Udemy for uncovered skills:', uncoveredSkills.join(', '));

                        const UDEMY_TOOL_ID = 'plugin-1717448083';
                        const udemySessionRes = await axios.post(
                            'https://api.on-demand.io/chat/v1/sessions',
                            {
                                pluginIds: [UDEMY_TOOL_ID],
                                externalUserId: userId?.toString() || 'guest',
                            },
                            { headers: { apikey: apiKey }, timeout: 15000 }
                        );
                        const udemySessionId = udemySessionRes.data?.data?.id;

                        console.log('[SkillGap] Udemy session created:', udemySessionId ? 'YES' : 'NO');

                        if (udemySessionId) {
                            for (const uSkill of uncoveredSkills.slice(0, 3)) {
                                try {
                                    const udemyPrompt = `Suggest me best courses for ${uSkill} which have rating of more than 4.0 and are beginner friendly`;

                                    const udemyQueryRes = await axios.post(
                                        `https://api.on-demand.io/chat/v1/sessions/${udemySessionId}/query`,
                                        {
                                            endpointId: 'predefined-openai-gpt4o',
                                            query: udemyPrompt,
                                            pluginIds: [UDEMY_TOOL_ID],
                                            responseMode: 'sync',
                                        },
                                        {
                                            headers: { apikey: apiKey, 'Content-Type': 'application/json' },
                                            timeout: 90000,
                                        }
                                    );

                                    const udemyAnswer = udemyQueryRes.data?.data?.answer || '';
                                    console.log(`[SkillGap] Udemy response for "${uSkill}":`, udemyAnswer.substring(0, 500));

                                    // Try to extract course info from the response text
                                    // The response may be JSON array, or natural language with course details
                                    const jsonMatch = udemyAnswer.match(/\[[\s\S]*\]/);
                                    if (jsonMatch) {
                                        const courses = JSON.parse(jsonMatch[0]);
                                        for (const uc of courses) {
                                            if (uc.title) {
                                                recommendations.push({
                                                    title: uc.title,
                                                    description: uc.description || `Udemy course for ${uSkill}`,
                                                    link: uc.url || `https://www.udemy.com/courses/search/?q=${encodeURIComponent(uSkill)}`,
                                                    provider: 'Udemy',
                                                    duration: uc.duration || 'Self-paced',
                                                    level: 'Beginner',
                                                    institution: uc.instructor || 'Udemy',
                                                    isFree: false,
                                                    matchedSkills: [uSkill],
                                                    score: 70,
                                                    reason: `Recommended for your "${uSkill}" gap — Found on Udemy${uc.rating ? ` (${uc.rating}★ rated)` : ''} — by ${uc.instructor || 'Udemy'}`,
                                                    matchScore: 70,
                                                });
                                            }
                                        }
                                        console.log(`[SkillGap] Added courses from Udemy for "${uSkill}"`);
                                    } else if (udemyAnswer.length > 20 && !udemyAnswer.includes("unable to access")) {
                                        // Natural language response — extract what we can and link to Udemy search
                                        recommendations.push({
                                            title: `Udemy courses for ${uSkill}`,
                                            description: udemyAnswer.substring(0, 200).replace(/\n/g, ' ').trim(),
                                            link: `https://www.udemy.com/courses/search/?q=${encodeURIComponent(uSkill)}`,
                                            provider: 'Udemy',
                                            duration: 'Self-paced',
                                            level: 'Beginner',
                                            institution: 'Udemy',
                                            isFree: false,
                                            matchedSkills: [uSkill],
                                            score: 60,
                                            reason: `Recommended for your "${uSkill}" gap — Search results from Udemy`,
                                            matchScore: 60,
                                        });
                                        console.log(`[SkillGap] Added Udemy search link for "${uSkill}"`);
                                    } else {
                                        console.log(`[SkillGap] Udemy couldn't find courses for "${uSkill}"`);
                                    }
                                } catch (perSkillErr: any) {
                                    console.error(`[SkillGap] Udemy query failed for "${uSkill}":`, perSkillErr.message);
                                }
                            }
                        }
                    } catch (udemyError: any) {
                        const errMsg = udemyError.response?.data
                            ? JSON.stringify(udemyError.response.data).substring(0, 300)
                            : udemyError.message;
                        console.error('[SkillGap] Udemy fallback failed (non-fatal):', errMsg);
                    }
                }

                data.learningPath = recommendations;
            } catch (courseError) {
                console.error('Course recommendation error (non-fatal):', courseError);
                data.learningPath = [];
            }
        } else {
            data.learningPath = [];
        }

        return sendSuccess(res, data, 'Skill gap analysis complete');

    } catch (error: any) {
        console.error('Skill Gap Analysis Error:', error.response?.data || error.message);
        return sendError(res, 500, 'Failed to analyze skill gap');
    }
};
