import { ollamaClient, ChatMessage } from './llm-client';
import { FeedbackData, CategoryScore } from './types';

const FEEDBACK_CATEGORIES = [
  'Communication Skills',
  'Technical Knowledge',
  'Problem Solving',
  'Cultural Fit',
  'Confidence and Clarity',
];

/**
 * FEEDBACK SCORING SYSTEM
 *
 * Each of the 5 categories is scored 0-100 by the LLM based on:
 *
 * 1. Communication Skills (weight: equal)
 *    - Clarity of expression, articulation
 *    - Ability to structure responses logically
 *    - Active listening indicators (referencing interviewer's questions)
 *    - Professional language use
 *
 * 2. Technical Knowledge (weight: equal)
 *    - Accuracy of technical concepts mentioned
 *    - Depth of understanding vs surface-level answers
 *    - Ability to explain technical decisions
 *    - Relevance of technical skills to the role
 *
 * 3. Problem Solving (weight: equal)
 *    - Structured approach to problems
 *    - Analytical thinking demonstrated
 *    - Real examples of problem resolution
 *    - Creative or innovative solutions mentioned
 *
 * 4. Cultural Fit (weight: equal)
 *    - Teamwork and collaboration indicators
 *    - Alignment with professional values
 *    - Enthusiasm and motivation shown
 *    - Adaptability and learning mindset
 *
 * 5. Confidence and Clarity (weight: equal)
 *    - Assertiveness without arrogance
 *    - Clear and concise responses
 *    - Handling of difficult questions
 *    - Overall presentation quality
 *
 * Total Score = Average of all 5 category scores (equal weight)
 *
 * Score Ranges:
 *   90-100: Exceptional — Ready for senior roles
 *   80-89:  Strong — Above average candidate
 *   70-79:  Good — Meets expectations
 *   60-69:  Fair — Needs improvement in some areas
 *   Below 60: Needs significant development
 */

const FEEDBACK_PROMPT = `You are an expert interview evaluator providing constructive, honest feedback.

Evaluate the candidate across 5 equally-weighted categories, each scored 0-100:

1. Communication Skills — Clarity, structure, articulation, professional language
2. Technical Knowledge — Accuracy, depth, ability to explain technical decisions
3. Problem Solving — Structured approach, analytical thinking, real examples
4. Cultural Fit — Teamwork, enthusiasm, adaptability, learning mindset
5. Confidence and Clarity — Assertiveness, concise responses, handling tough questions

SCORING GUIDELINES:
- 90-100: Exceptional performance
- 80-89: Strong, above average
- 70-79: Good, meets expectations
- 60-69: Fair, needs some improvement
- Below 60: Needs significant development
- Be honest but constructive. Give credit where earned.

Return ONLY a valid JSON object:
{
  "categoryScores": [
    { "name": "Communication Skills", "score": <0-100>, "comment": "<specific observation>" },
    { "name": "Technical Knowledge", "score": <0-100>, "comment": "<specific observation>" },
    { "name": "Problem Solving", "score": <0-100>, "comment": "<specific observation>" },
    { "name": "Cultural Fit", "score": <0-100>, "comment": "<specific observation>" },
    { "name": "Confidence and Clarity", "score": <0-100>, "comment": "<specific observation>" }
  ],
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "areasForImprovement": ["<area 1>", "<area 2>", "<area 3>"],
  "finalAssessment": "<2-3 sentence balanced assessment>"
}

CRITICAL: Return ONLY JSON. No markdown, no code fences, no extra text.`;

const FEEDBACK_LANG_PROMPT: Record<string, string> = {
  hi: `\n\nIMPORTANT LANGUAGE RULE: Write ALL text values (comments, strengths, areasForImprovement, finalAssessment) in Hindi (Hinglish is fine — mix Hindi and English naturally). Technical terms can stay in English. Keep JSON keys in English. Scores are numbers.`,
  mr: `\n\nIMPORTANT LANGUAGE RULE: Write ALL text values (comments, strengths, areasForImprovement, finalAssessment) in Marathi. Technical terms can stay in English. Keep JSON keys in English. Scores are numbers.`,
};

class FeedbackGenerator {
  async generateFeedback(
    transcript: { role: string; content: string }[],
    language = 'en',
  ): Promise<FeedbackData> {
    const userMessages = transcript.filter(m => m.role === 'user');

    // If not enough conversation, return a minimal feedback
    if (userMessages.length < 1) {
      return this.getInsufficientDataFeedback(
        'The interview ended before any responses were given.'
      );
    }

    const formattedTranscript = transcript
      .filter(m => m.role !== 'system')
      .map(m => `${m.role === 'user' ? 'Candidate' : 'Interviewer'}: ${m.content}`)
      .join('\n\n');

    console.log('[Feedback] Generating feedback from', userMessages.length, 'user messages');

    try {
      const langSuffix = FEEDBACK_LANG_PROMPT[language] || '';
      const messages: ChatMessage[] = [
        { role: 'system', content: FEEDBACK_PROMPT + langSuffix },
        { role: 'user', content: `Interview Transcript:\n\n${formattedTranscript}` },
      ];

      const response = await ollamaClient.generateResponse(messages);
      console.log('[Feedback] Raw LLM response:', response.slice(0, 200));

      return this.parseResponse(response);
    } catch (error) {
      console.error('[Feedback] Generation failed:', error);
      return this.getInsufficientDataFeedback(
        'Feedback generation encountered an error. Please try again.'
      );
    }
  }

  private parseResponse(response: string): FeedbackData {
    try {
      const cleaned = this.cleanJsonString(response);
      const parsed = JSON.parse(cleaned);
      return this.normalizeFeedback(parsed);
    } catch (error) {
      console.error('[Feedback] JSON parse failed:', error);
      return this.getInsufficientDataFeedback(
        'Could not parse feedback. The AI response was malformed.'
      );
    }
  }

  private cleanJsonString(input: string): string {
    let cleaned = input;
    cleaned = cleaned.replace(/```json\s*/gi, '');
    cleaned = cleaned.replace(/```\s*/g, '');
    cleaned = cleaned.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }

    return cleaned.trim();
  }

  private normalizeFeedback(data: Record<string, unknown>): FeedbackData {
    const categoryScores: CategoryScore[] = FEEDBACK_CATEGORIES.map(name => {
      const found = (data.categoryScores as Record<string, unknown>[] | undefined)?.find(
        (c: Record<string, unknown>) => c.name === name,
      );

      if (found && typeof found.score === 'number') {
        return {
          name,
          score: Math.min(100, Math.max(0, found.score)),
          comment: String(found.comment || 'No comment provided'),
        };
      }

      return {
        name,
        score: 'Cannot be determined' as const,
        comment: 'Could not evaluate from the transcript.',
      };
    });

    // Calculate total score as average of numeric scores
    const numericScores = categoryScores
      .map(c => c.score)
      .filter((s): s is number => typeof s === 'number');

    const totalScore = numericScores.length > 0
      ? Math.round(numericScores.reduce((a, b) => a + b, 0) / numericScores.length)
      : ('Cannot be determined' as const);

    return {
      totalScore,
      categoryScores,
      strengths: Array.isArray(data.strengths)
        ? data.strengths.map(String)
        : ['Could not determine strengths'],
      areasForImprovement: Array.isArray(data.areasForImprovement)
        ? data.areasForImprovement.map(String)
        : ['Could not determine areas for improvement'],
      finalAssessment: typeof data.finalAssessment === 'string'
        ? data.finalAssessment
        : 'Assessment could not be fully generated.',
    };
  }

  private getInsufficientDataFeedback(reason: string): FeedbackData {
    return {
      totalScore: 'Cannot be determined',
      categoryScores: FEEDBACK_CATEGORIES.map(name => ({
        name,
        score: 'Cannot be determined' as const,
        comment: 'Insufficient data for evaluation.',
      })),
      strengths: ['Participated in the interview'],
      areasForImprovement: ['Provide more detailed responses for better feedback'],
      finalAssessment: reason,
    };
  }
}

export const feedbackGenerator = new FeedbackGenerator();
