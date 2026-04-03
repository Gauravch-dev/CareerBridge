import express from 'express';
import { recommendCourses, recommendBySkill, listCourses } from '../controllers/course.controller';
import { authenticateUser } from '../middleware/auth.middleware';

const router = express.Router();

router.post('/recommend', authenticateUser, recommendCourses);
router.post('/recommend-by-skill', authenticateUser, recommendBySkill);
router.get('/', authenticateUser, listCourses);

export default router;
