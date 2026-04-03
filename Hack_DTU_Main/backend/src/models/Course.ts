import mongoose, { Document, Schema } from 'mongoose';

export interface ICourse extends Document {
    title: string;
    provider: 'NPTEL' | 'SWAYAM' | 'SkillIndia' | 'eSkillIndia';
    url: string;
    skills: string[];
    skillsText: string;
    skillsEmbedding?: number[];
    duration: string;
    level: 'Beginner' | 'Intermediate' | 'Advanced';
    language: string;
    isFree: boolean;
    institution?: string;
    description: string;
    active: boolean;
}

const CourseSchema: Schema = new Schema(
    {
        title: { type: String, required: true },
        provider: {
            type: String,
            required: true,
            enum: ['NPTEL', 'SWAYAM', 'SkillIndia', 'eSkillIndia'],
        },
        url: { type: String, required: true },
        skills: [{ type: String }],
        skillsText: { type: String, required: true },
        skillsEmbedding: { type: [Number], select: false },
        duration: { type: String, default: 'Self-paced' },
        level: {
            type: String,
            enum: ['Beginner', 'Intermediate', 'Advanced'],
            default: 'Beginner',
        },
        language: { type: String, default: 'English' },
        isFree: { type: Boolean, default: true },
        institution: { type: String },
        description: { type: String, required: true },
        active: { type: Boolean, default: true },
    },
    { timestamps: true },
);

CourseSchema.index({ skills: 1 });
CourseSchema.index({ provider: 1 });

export default mongoose.model<ICourse>('Course', CourseSchema);
