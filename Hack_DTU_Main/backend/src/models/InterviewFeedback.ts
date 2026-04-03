import mongoose, { Document, Schema } from 'mongoose';

export interface ICategoryScore {
    name: string;
    score: number | string;
    comment: string;
}

export interface IConversationEntry {
    role: string;
    content: string;
}

export interface IProctoringSummary {
    integrityScore: number;
    totalViolations: number;
    violations: {
        timestamp: string;
        type: string;
        duration: number;
        confidence: number;
        details?: string;
    }[];
    summary: {
        tabSwitches: number;
        lookAwayEvents: number;
        multipleFaceEvents: number;
        noFaceEvents: number;
        autoTerminated: boolean;
    };
}

export interface IInterviewFeedback extends Document {
    interviewId: string;
    userId: string;
    totalScore: number | string;
    categoryScores: ICategoryScore[];
    strengths: string[];
    areasForImprovement: string[];
    finalAssessment: string;
    conversationHistory: IConversationEntry[];
    proctoringSummary?: IProctoringSummary;
    terminated?: boolean;
    createdAt: Date;
}

const InterviewFeedbackSchema: Schema = new Schema(
    {
        interviewId: { type: String, required: true, index: true },
        userId: { type: String, required: true, index: true },
        totalScore: { type: Schema.Types.Mixed, required: true },
        categoryScores: [
            {
                name: { type: String, required: true },
                score: { type: Schema.Types.Mixed, required: true },
                comment: { type: String, required: true },
            },
        ],
        strengths: [{ type: String }],
        areasForImprovement: [{ type: String }],
        finalAssessment: { type: String, required: true },
        conversationHistory: [
            {
                role: { type: String, required: true },
                content: { type: String, required: true },
            },
        ],
        terminated: { type: Boolean, default: false },
        proctoringSummary: {
            type: {
                integrityScore: { type: Number, default: 100 },
                totalViolations: { type: Number, default: 0 },
                violations: [{
                    timestamp: String,
                    type: { type: String, enum: ['no_face', 'multiple_faces', 'looking_away', 'tab_switch'] },
                    duration: Number,
                    confidence: Number,
                    details: String,
                }],
                summary: {
                    tabSwitches: { type: Number, default: 0 },
                    lookAwayEvents: { type: Number, default: 0 },
                    multipleFaceEvents: { type: Number, default: 0 },
                    noFaceEvents: { type: Number, default: 0 },
                    autoTerminated: { type: Boolean, default: false },
                },
            },
            required: false,
            default: undefined,
        },
    },
    {
        timestamps: true,
    }
);

InterviewFeedbackSchema.index({ interviewId: 1, userId: 1 });

export default mongoose.model<IInterviewFeedback>('InterviewFeedback', InterviewFeedbackSchema);
