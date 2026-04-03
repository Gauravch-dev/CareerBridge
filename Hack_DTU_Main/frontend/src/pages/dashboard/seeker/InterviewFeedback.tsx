import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Loader2,
  AlertCircle,
  ArrowLeft,
  Printer,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Shield,
  Eye,
  Monitor,
  Users,
  UserX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { FeedbackData } from '@/lib/interview/types';

const API_BASE = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api`;

function getScoreColor(score: number | string): string {
  if (typeof score !== 'number') return 'text-muted-foreground';
  if (score >= 80) return 'text-green-500';
  if (score >= 50) return 'text-yellow-500';
  return 'text-red-500';
}

function getProgressColor(score: number | string): string {
  if (typeof score !== 'number') return 'bg-muted';
  if (score >= 80) return '[&>div]:bg-green-500';
  if (score >= 50) return '[&>div]:bg-yellow-500';
  return '[&>div]:bg-red-500';
}

function getScoreNum(score: number | string): number {
  return typeof score === 'number' ? score : 0;
}

export const InterviewFeedback = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [feedback, setFeedback] = useState<FeedbackData | null>(null);
  const [isTerminated, setIsTerminated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const authToken = localStorage.getItem('authToken');

  useEffect(() => {
    const fetchFeedback = async () => {
      if (!id) return;

      try {
        const res = await fetch(`${API_BASE}/interview/${id}/feedback`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });

        if (!res.ok) {
          throw new Error(t('feedback.fetchError'));
        }

        const json = await res.json();
        const raw = json.data || json.feedback || json;
        setFeedback(raw);
        if (raw.terminated || raw.proctoringSummary?.summary?.autoTerminated) {
          setIsTerminated(true);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : t('feedback.fetchError');
        setError(message);
        toast.error(message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFeedback();
  }, [id, authToken, t]);

  const handleDownloadPDF = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-muted-foreground">{t('feedback.loading')}</p>
        </div>
      </div>
    );
  }

  if (error || !feedback) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-4 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500" />
          <h2 className="text-xl font-semibold">{t('feedback.errorTitle')}</h2>
          <p className="text-muted-foreground">{error || t('feedback.notFound')}</p>
          <Button variant="outline" onClick={() => navigate('/dashboard/mock-interview')}>
            {t('feedback.backToDashboard')}
          </Button>
        </div>
      </div>
    );
  }

  const totalScore = getScoreNum(feedback.totalScore);
  const circumference = 2 * Math.PI * 54;
  const strokeDashoffset = circumference - (totalScore / 100) * circumference;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in print:space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/dashboard/mock-interview')}
            className="print:hidden"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-display font-bold">
              {t('feedback.title')}
            </h1>
            <p className="text-muted-foreground text-sm">
              {t('feedback.subtitle')}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          className="gap-2 print:hidden"
          onClick={handleDownloadPDF}
        >
          <Printer className="w-4 h-4" />
          {t('feedback.downloadPDF')}
        </Button>
      </div>

      {/* Terminated Banner */}
      {isTerminated && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-600">Interview Terminated</p>
            <p className="text-xs text-red-500/80">
              This interview was auto-terminated due to repeated violations.
              These results are temporary and will not appear in your interview history.
            </p>
          </div>
        </div>
      )}

      {/* Total Score - Circular Progress */}
      <div className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center">
        <div className="relative w-36 h-36 mb-4">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-muted/30"
            />
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className={getScoreColor(feedback.totalScore).replace('text-', 'stroke-')}
              style={{ transition: 'stroke-dashoffset 1s ease-out' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-3xl font-bold ${getScoreColor(feedback.totalScore)}`}>
              {typeof feedback.totalScore === 'number' ? feedback.totalScore : '--'}
            </span>
            <span className="text-xs text-muted-foreground">{t('feedback.outOf100')}</span>
          </div>
        </div>
        <h3 className="text-lg font-semibold">{t('feedback.overallScore')}</h3>
        {typeof feedback.totalScore === 'number' && (
          <Badge
            variant="secondary"
            className={`mt-2 ${
              totalScore >= 80
                ? 'bg-green-500/10 text-green-600'
                : totalScore >= 50
                ? 'bg-yellow-500/10 text-yellow-600'
                : 'bg-red-500/10 text-red-600'
            }`}
          >
            {totalScore >= 80
              ? t('feedback.excellent')
              : totalScore >= 50
              ? t('feedback.good')
              : t('feedback.needsWork')}
          </Badge>
        )}
      </div>

      {/* Category Scores */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h3 className="text-lg font-semibold mb-6">{t('feedback.categoryScores')}</h3>
        <div className="space-y-5">
          {(feedback.categoryScores || []).map((category) => (
            <div key={category.name}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{category.name}</span>
                <span className={`text-sm font-bold ${getScoreColor(category.score)}`}>
                  {typeof category.score === 'number' ? `${category.score}/100` : category.score}
                </span>
              </div>
              <Progress
                value={getScoreNum(category.score)}
                className={`h-2.5 ${getProgressColor(category.score)}`}
              />
              <p className="text-xs text-muted-foreground mt-1.5">{category.comment}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Interview Integrity Report */}
      {(feedback as any).proctoringSummary && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <Shield className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold">Interview Integrity Report</h3>
          </div>

          {/* Integrity Score */}
          <div className="flex items-center gap-6 mb-6">
            <div className="relative w-20 h-20">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
                <circle
                  cx="60" cy="60" r="54" fill="none" strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 54}
                  strokeDashoffset={2 * Math.PI * 54 - ((feedback as any).proctoringSummary.integrityScore / 100) * 2 * Math.PI * 54}
                  className={
                    (feedback as any).proctoringSummary.integrityScore >= 80 ? 'stroke-green-500' :
                    (feedback as any).proctoringSummary.integrityScore >= 50 ? 'stroke-yellow-500' : 'stroke-red-500'
                  }
                  style={{ transition: 'stroke-dashoffset 1s ease-out' }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-lg font-bold ${getScoreColor((feedback as any).proctoringSummary.integrityScore)}`}>
                  {(feedback as any).proctoringSummary.integrityScore}
                </span>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium">Integrity Score</p>
              <p className="text-xs text-muted-foreground">
                {(feedback as any).proctoringSummary.totalViolations} violation{(feedback as any).proctoringSummary.totalViolations !== 1 ? 's' : ''} detected
              </p>
              {(feedback as any).proctoringSummary.summary.autoTerminated && (
                <Badge variant="destructive" className="mt-1 text-xs">Auto-terminated</Badge>
              )}
            </div>
          </div>

          {/* Violation Breakdown */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <Monitor className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-lg font-bold">{(feedback as any).proctoringSummary.summary.tabSwitches}</p>
                <p className="text-[10px] text-muted-foreground">Tab Switches</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <Eye className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-lg font-bold">{(feedback as any).proctoringSummary.summary.lookAwayEvents}</p>
                <p className="text-[10px] text-muted-foreground">Look Away</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <Users className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-lg font-bold">{(feedback as any).proctoringSummary.summary.multipleFaceEvents}</p>
                <p className="text-[10px] text-muted-foreground">Multiple Faces</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <UserX className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-lg font-bold">{(feedback as any).proctoringSummary.summary.noFaceEvents}</p>
                <p className="text-[10px] text-muted-foreground">No Face</p>
              </div>
            </div>
          </div>

          {/* Violation Timeline */}
          {(feedback as any).proctoringSummary.violations.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-3">Violation Timeline</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {(feedback as any).proctoringSummary.violations.map((v: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 text-xs p-2 rounded-lg bg-muted/30">
                    <span className="text-muted-foreground shrink-0 font-mono">
                      {new Date(v.timestamp).toLocaleTimeString()}
                    </span>
                    <AlertTriangle className="w-3 h-3 text-yellow-500 shrink-0" />
                    <span className="capitalize">{v.type.replace(/_/g, ' ')}</span>
                    {v.details && <span className="text-muted-foreground">— {v.details}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Strengths and Areas for Improvement */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Strengths */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <h3 className="text-lg font-semibold">{t('feedback.strengths')}</h3>
          </div>
          <ul className="space-y-3">
            {(feedback.strengths || []).map((strength, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <TrendingUp className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                <span>{strength}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Areas for Improvement */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            <h3 className="text-lg font-semibold">{t('feedback.areasToImprove')}</h3>
          </div>
          <ul className="space-y-3">
            {(feedback.areasForImprovement || []).map((area, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
                <span>{area}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Final Assessment */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h3 className="text-lg font-semibold mb-3">{t('feedback.finalAssessment')}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {feedback.finalAssessment}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-center gap-4 pb-8 print:hidden">
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => navigate('/dashboard/mock-interview')}
        >
          <ArrowLeft className="w-4 h-4" />
          {t('feedback.backToDashboard')}
        </Button>
      </div>
    </div>
  );
};
