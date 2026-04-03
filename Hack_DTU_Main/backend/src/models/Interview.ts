import mongoose, { Document, Schema } from 'mongoose';

export interface IInterview extends Document {
    role: string;
    type: string;
    level: string;
    techstack: string[];
    questions: string[];
    userId: string;
    targetRole: string;
    language: string;
    createdAt: Date;
}

const InterviewSchema: Schema = new Schema(
    {
        role: { type: String, required: true },
        type: { type: String, required: true, enum: ['Technical', 'Behavioral', 'Mixed'] },
        level: { type: String, required: true, enum: ['Junior', 'Mid-level', 'Senior'] },
        techstack: [{ type: String }],
        questions: [{ type: String }],
        userId: { type: String, required: true, index: true },
        targetRole: { type: String, required: true },
        language: { type: String, default: 'en', enum: ['en', 'hi', 'mr'] },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model<IInterview>('Interview', InterviewSchema);
