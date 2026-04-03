import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

import { connectDB } from './config/db';
import authRoutes from './routes/auth.routes';
import protectedRoutes from './routes/protected.routes';
import jobSeekerRoutes from './routes/jobSeeker.routes';
import uploadRoutes from './routes/upload.routes';
import ondemandRoutes from './routes/ondemand.routes';
import employerRoutes from './routes/employer.routes';
import jobRoutes from './routes/job.routes';
import recommendationRoutes from './routes/recommendation.routes';
import sttRoutes from './routes/stt.routes';
import ttsRoutes from './routes/tts.routes';
import interviewRoutes from './routes/interview.routes';
import ollamaProxyRoutes from './routes/ollama-proxy.routes';
import courseRoutes from './routes/course.routes';
import structureRoutes from './routes/structure.routes';

import { createServer } from 'http';
import { socketService } from './services/socket.service';

// Connect to MongoDB
connectDB();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;

// Init Socket.io
socketService.init(httpServer);

// Middleware
app.use(helmet());
app.use(cors({
    origin: [
        "http://localhost:5173",
        "http://localhost:8080",
        "http://localhost:8081",
        process.env.CLIENT_URL,
    ].filter(Boolean) as string[],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
}));
app.use(express.json());
app.use(morgan('dev'));

// Serve Static Files
app.use('/uploads', express.static('uploads'));

// Public route: Mock test questions from brainwave DB
app.get('/api/pyqs', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
            return res.status(500).json({ error: "Database not connected yet" });
        }

        const mongooseConnection = mongoose.connection as any;
        const targetDb = mongooseConnection.client?.db('brainwave');
        if (!targetDb) {
            return res.status(500).json({ error: 'Failed to connect to brainwave database' });
        }

        const collection = targetDb.collection('mocktest_data');
        const questions = await collection.find({}).toArray();
        res.status(200).json(questions);
    } catch (error) {
        console.error("Error serving questions:", error);
        res.status(500).json({ error: "Failed to load questions" });
    }
});

// Routes (public first, then protected)
app.use('/auth', authRoutes);
app.use('/api/stt', sttRoutes);
app.use('/api/tts', ttsRoutes);
app.use('/api/structure', structureRoutes);
app.use('/api/ollama-proxy', ollamaProxyRoutes);
app.use('/api', protectedRoutes);
app.use('/api/job-seeker', jobSeekerRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/ondemand', ondemandRoutes);
app.use('/api/employer', employerRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/interview', interviewRoutes);
app.use('/api/courses', courseRoutes);

app.get('/', (req, res) => {
    res.send('API is running...');
});

httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
