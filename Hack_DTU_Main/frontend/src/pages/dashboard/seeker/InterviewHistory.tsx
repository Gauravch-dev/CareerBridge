import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, Mic, TrendingUp, TrendingDown, Minus, Calendar, ChevronRight, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const API_BASE = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api`;

interface FeedbackRecord {
  _id: string;
  interviewId: string;
  totalScore: number | string;
  categoryScores: { name: string; score: number | string; comment: string }[];
  strengths: string[];
  areasForImprovement: string[];
  finalAssessment: string;
  createdAt: string;
}

interface InterviewRecord {
  _id: string;
  role: string;
  type: string;
  level: string;
  techstack: string[];
}

const getScoreColor = (score: number | string) => {
  if (typeof score !== 'number') return 'text-muted-foreground';
  if (score >= 80) return 'text-green-500';
  if (score >= 60) return 'text-yellow-500';
  return 'text-red-500';
};

const getScoreBg = (score: number | string) => {
  if (typeof score !== 'number') return 'bg-muted';
  if (score >= 80) return 'bg-green-500/10 border-green-500/20';
  if (score >= 60) return 'bg-yellow-500/10 border-yellow-500/20';
  return 'bg-red-500/10 border-red-500/20';
};

const getTrend = (current: number, previous: number) => {
  const diff = current - previous;
  if (diff > 5) return { icon: TrendingUp, color: 'text-green-500', label: `+${diff}` };
  if (diff < -5) return { icon: TrendingDown, color: 'text-red-500', label: `${diff}` };
  return { icon: Minus, color: 'text-muted-foreground', label: '0' };
};

export const InterviewHistory = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [feedbacks, setFeedbacks] = useState<FeedbackRecord[]>([]);
  const [interviews, setInterviews] = useState<Map<string, InterviewRecord>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  const authToken = localStorage.getItem('authToken');

  useEffect(() => {
    const loadHistory = async () => {
      try {
        // Fetch all feedback
        const fbRes = await fetch(`${API_BASE}/interview/my-feedback`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!fbRes.ok) throw new Error('Failed to fetch feedback');
        const fbJson = await fbRes.json();
        const fbList: FeedbackRecord[] = fbJson.data || fbJson || [];

        // Fetch all interviews to get role/type info
        const intRes = await fetch(`${API_BASE}/interview/list`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (intRes.ok) {
          const intJson = await intRes.json();
          const intList: InterviewRecord[] = intJson.data || intJson || [];
          const intMap = new Map<string, InterviewRecord>();
          intList.forEach(i => intMap.set(i._id, i));
          setInterviews(intMap);
        }

        // Sort by date descending
        fbList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setFeedbacks(fbList);
      } catch (error) {
        console.error('Failed to load history:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadHistory();
  }, [authToken]);

  // Calculate average score across all attempts
  const numericScores = feedbacks
    .map(f => f.totalScore)
    .filter((s): s is number => typeof s === 'number');
  const avgScore = numericScores.length > 0
    ? Math.round(numericScores.reduce((a, b) => a + b, 0) / numericScores.length)
    : null;

  // Best score
  const bestScore = numericScores.length > 0 ? Math.max(...numericScores) : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-bold mb-2">Interview History</h1>
        <p className="text-muted-foreground">Track your interview performance over time.</p>
      </div>

      {/* Stats Cards */}
      {feedbacks.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Mic className="w-5 h-5 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground">Total Interviews</span>
            </div>
            <p className="text-3xl font-display font-bold">{feedbacks.length}</p>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-blue-500" />
              </div>
              <span className="text-sm text-muted-foreground">Average Score</span>
            </div>
            <p className={`text-3xl font-display font-bold ${avgScore ? getScoreColor(avgScore) : ''}`}>
              {avgScore !== null ? `${avgScore}/100` : 'N/A'}
            </p>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <span className="text-sm text-muted-foreground">Best Score</span>
            </div>
            <p className={`text-3xl font-display font-bold ${bestScore ? getScoreColor(bestScore) : ''}`}>
              {bestScore !== null ? `${bestScore}/100` : 'N/A'}
            </p>
          </div>
        </div>
      )}

      {/* Feedback List */}
      {feedbacks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-border rounded-2xl">
          <Mic className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
          <h3 className="text-xl font-bold mb-2">No interviews yet</h3>
          <p className="text-muted-foreground mb-6">Complete an AI mock interview to see your score history.</p>
          <Button onClick={() => navigate('/dashboard/mock-interview')}>
            Start Mock Interview
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {feedbacks.map((fb, index) => {
            const interview = interviews.get(fb.interviewId);
            const score = fb.totalScore;
            const prevFb = feedbacks[index + 1]; // Older entry
            const prevScore = prevFb?.totalScore;
            const trend = typeof score === 'number' && typeof prevScore === 'number'
              ? getTrend(score, prevScore)
              : null;

            return (
              <div
                key={fb._id}
                className="group bg-card border border-border rounded-2xl p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer"
                onClick={() => navigate(`/dashboard/interview/${fb.interviewId}/feedback`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Score Circle */}
                    <div className={`w-16 h-16 rounded-2xl border-2 flex items-center justify-center ${getScoreBg(score)}`}>
                      <span className={`text-xl font-display font-bold ${getScoreColor(score)}`}>
                        {typeof score === 'number' ? score : '?'}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-bold text-lg group-hover:text-primary transition-colors">
                        {interview?.role || 'Interview'}
                      </h3>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(fb.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                        {interview?.type && (
                          <Badge variant="secondary" className="text-xs">{interview.type}</Badge>
                        )}
                        {interview?.level && (
                          <Badge variant="outline" className="text-xs">{interview.level}</Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Trend indicator */}
                    {trend && (
                      <div className={`flex items-center gap-1 text-sm font-medium ${trend.color}`}>
                        <trend.icon className="w-4 h-4" />
                        {trend.label}
                      </div>
                    )}

                    {/* Category mini bars */}
                    <div className="hidden md:flex items-center gap-1">
                      {(fb.categoryScores || []).map((cat) => (
                        <div key={cat.name} className="w-1.5 h-8 rounded-full bg-muted overflow-hidden" title={`${cat.name}: ${cat.score}`}>
                          <div
                            className={`w-full rounded-full ${
                              typeof cat.score === 'number' && cat.score >= 80 ? 'bg-green-500' :
                              typeof cat.score === 'number' && cat.score >= 60 ? 'bg-yellow-500' :
                              typeof cat.score === 'number' ? 'bg-red-500' : 'bg-muted'
                            }`}
                            style={{ height: `${typeof cat.score === 'number' ? cat.score : 0}%`, marginTop: 'auto' }}
                          />
                        </div>
                      ))}
                    </div>

                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </div>

                {/* Assessment preview */}
                {fb.finalAssessment && (
                  <p className="text-sm text-muted-foreground mt-3 line-clamp-2 pl-20">
                    {fb.finalAssessment}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
