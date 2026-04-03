export enum CallStatus {
  INACTIVE = 'INACTIVE',
  CONNECTING = 'CONNECTING',
  ACTIVE = 'ACTIVE',
  FINISHED = 'FINISHED',
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

export interface FeedbackData {
  totalScore: number | string;
  categoryScores: CategoryScore[];
  strengths: string[];
  areasForImprovement: string[];
  finalAssessment: string;
}

export interface CategoryScore {
  name: string;
  score: number | string;
  comment: string;
}

export interface InterviewData {
  id: string;
  role: string;
  type: string;
  level: string;
  techstack: string[];
  questions: string[];
  language?: string;
}

export interface ConversationEventCallbacks {
  onCallStart?: () => void;
  onCallEnd?: () => void;
  onMessage?: (message: { role: string; content: string }) => void;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  onError?: (error: Error) => void;
}
