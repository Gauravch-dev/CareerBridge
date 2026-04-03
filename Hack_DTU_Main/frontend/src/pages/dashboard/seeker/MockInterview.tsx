import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mic,
  Loader2,
  Sparkles,
  Clock,
  Users,
  ArrowRight,
  RefreshCw,
  Plus,
  Briefcase,
  Code2,
  MessageSquare,
  Shuffle,
  Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

const API_BASE = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api`;

interface Interview {
  id: string;
  role: string;
  type: string;
  level: string;
  techstack: string[];
  questions: string[];
  language?: string;
  createdAt: string;
  coverImage?: string;
}

const LANG_OPTIONS = [
  { value: 'en', label: 'English', flag: 'EN' },
  { value: 'hi', label: 'हिंदी (Hindi)', flag: 'HI' },
  { value: 'mr', label: 'मराठी (Marathi)', flag: 'MR' },
];

interface UserProfile {
  personalInfo?: { bio?: string; fullName?: string };
  skills?: string[];
  experience?: { role: string; company: string; duration: string; description: string }[];
  education?: { institution: string; degree: string; year: number; score?: string }[];
}

const LEVEL_COLORS: Record<string, string> = {
  Junior: 'bg-green-500/10 text-green-600 border-green-500/20',
  'Mid-level': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  Senior: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  Lead: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
};

const TYPE_COLORS: Record<string, string> = {
  Technical: 'bg-cyan-500/10 text-cyan-600',
  Behavioral: 'bg-pink-500/10 text-pink-600',
  Mixed: 'bg-amber-500/10 text-amber-600',
};

const TYPE_ICONS: Record<string, typeof Code2> = {
  Technical: Code2,
  Behavioral: MessageSquare,
  Mixed: Shuffle,
};

export const MockInterview = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');

  // Generate dialog state
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [interviewType, setInterviewType] = useState('Mixed');
  const [targetRole, setTargetRole] = useState('');
  const [interviewLang, setInterviewLang] = useState('en');

  const authToken = localStorage.getItem('authToken');

  const loadInterviews = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/interview/list`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!res.ok) throw new Error('Failed to fetch interviews');

      const json = await res.json();
      const raw = json.data || json;
      const interviewList: Interview[] = (Array.isArray(raw) ? raw : raw.interviews || []).map((i: any) => ({
        ...i,
        id: i._id || i.id,
      }));

      // Sort by createdAt descending
      interviewList.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      setInterviews(interviewList);
    } catch (error) {
      console.error('Failed to load interviews:', error);
      toast.error(t('mockInterview.loadError', 'Failed to load interviews'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInterviews();
  }, []);

  const filteredInterviews =
    filterType === 'all'
      ? interviews
      : interviews.filter((i) => i.type === filterType);

  const handleStartInterview = (interviewId: string) => {
    navigate(`/dashboard/interview/${interviewId}/ready`);
  };

  const handleOpenGenerate = async () => {
    setIsGenerateOpen(true);
    setIsLoadingProfile(true);

    try {
      const res = await fetch(`${API_BASE}/job-seeker/profile`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        const p = data.data || data.profile || data;
        setProfile(p);
        // Default target role from latest experience
        const latestRole = p.experience?.[0]?.role || '';
        setTargetRole(latestRole);
      }
    } catch {
      // Profile fetch failed - user can still generate
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);

    try {
      const res = await fetch(`${API_BASE}/interview/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          profileData: {
            targetRole: targetRole,
            skills: profile?.skills || [],
            experience: profile?.experience || [],
            education: profile?.education || [],
            bio: profile?.personalInfo?.bio || '',
            type: interviewType,
            language: interviewLang,
          },
        }),
      });

      if (!res.ok) throw new Error('Failed to generate interview');

      toast.success(t('mockInterview.generateSuccess', 'Interview generated successfully!'));
      setIsGenerateOpen(false);
      await loadInterviews();
    } catch (error) {
      console.error('Failed to generate interview:', error);
      toast.error(t('mockInterview.generateError', 'Failed to generate interview'));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/10 via-accent/5 to-purple-500/10 border border-primary/20 p-8 md:p-10">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-40 h-40 bg-accent/10 rounded-full blur-3xl" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="p-4 bg-background/80 backdrop-blur-sm rounded-2xl border border-primary/20 shadow-lg">
              <Mic className="w-8 h-8 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-3xl font-display font-bold">
                  {t('mockInterview.title')}
                </h1>
                <Badge className="bg-primary/10 text-primary border-primary/20">
                  <Sparkles className="w-3 h-3 mr-1" />
                  AI
                </Badge>
              </div>
              <p className="text-muted-foreground text-lg max-w-xl">
                {t('mockInterview.subtitle')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleOpenGenerate}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              {t('mockInterview.generateInterview', 'Generate Interview')}
            </Button>
            <Button variant="outline" size="sm" onClick={loadInterviews} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              {t('mockInterview.refresh')}
            </Button>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            icon: Mic,
            title: t('mockInterview.step1Title'),
            desc: t('mockInterview.step1Desc'),
            color: 'text-blue-500',
            bg: 'bg-blue-500/10',
          },
          {
            icon: Sparkles,
            title: t('mockInterview.step2Title'),
            desc: t('mockInterview.step2Desc'),
            color: 'text-purple-500',
            bg: 'bg-purple-500/10',
          },
          {
            icon: Users,
            title: t('mockInterview.step3Title'),
            desc: t('mockInterview.step3Desc'),
            color: 'text-green-500',
            bg: 'bg-green-500/10',
          },
        ].map((step, i) => (
          <div
            key={i}
            className="flex items-start gap-4 p-5 rounded-2xl bg-card border border-border hover:border-primary/20 transition-colors"
          >
            <div
              className={`w-10 h-10 rounded-xl ${step.bg} ${step.color} flex items-center justify-center shrink-0`}
            >
              <step.icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm">{step.title}</h3>
              <p className="text-xs text-muted-foreground mt-1">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        {['all', 'Technical', 'Behavioral', 'Mixed'].map((type) => (
          <Badge
            key={type}
            variant={filterType === type ? 'default' : 'outline'}
            className="px-3 py-1 cursor-pointer hover:bg-muted"
            onClick={() => setFilterType(type)}
          >
            {type === 'all' ? t('mockInterview.allTypes') : type}
          </Badge>
        ))}
      </div>

      {/* Interview Grid */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredInterviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-border rounded-2xl">
          <Mic className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
          <h3 className="text-xl font-bold mb-2">
            {t('mockInterview.noInterviews')}
          </h3>
          <p className="text-muted-foreground mb-4">
            {t('mockInterview.noInterviewsDesc')}
          </p>
          <Button onClick={handleOpenGenerate} className="gap-2">
            <Plus className="w-4 h-4" />
            {t('mockInterview.generateInterview', 'Generate Interview')}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredInterviews.map((interview) => (
            <div
              key={interview.id}
              className="group bg-card border border-border rounded-2xl p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer relative overflow-hidden"
              onClick={() => handleStartInterview(interview.id)}
            >
              {/* Accent bar */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-accent opacity-0 group-hover:opacity-100 transition-opacity" />

              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-display font-bold text-lg group-hover:text-primary transition-colors">
                    {interview.role}
                  </h3>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge
                      variant="outline"
                      className={`text-xs ${LEVEL_COLORS[interview.level] || ''}`}
                    >
                      {interview.level}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className={`text-xs ${TYPE_COLORS[interview.type] || ''}`}
                    >
                      {interview.type}
                    </Badge>
                    {interview.language && interview.language !== 'en' && (
                      <Badge variant="outline" className="text-xs">
                        {interview.language === 'hi' ? 'हिंदी' : interview.language === 'mr' ? 'मराठी' : interview.language.toUpperCase()}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Mic className="w-6 h-6" />
                </div>
              </div>

              {/* Tech stack */}
              {interview.techstack && interview.techstack.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {interview.techstack.slice(0, 4).map((tech) => (
                    <span
                      key={tech}
                      className="px-2 py-0.5 bg-muted text-xs rounded-md font-medium"
                    >
                      {tech}
                    </span>
                  ))}
                  {interview.techstack.length > 4 && (
                    <span className="px-2 py-0.5 bg-muted text-xs rounded-md text-muted-foreground">
                      +{interview.techstack.length - 4}
                    </span>
                  )}
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-border/50">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {interview.questions?.length || 0} {t('mockInterview.questions')}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-primary group-hover:bg-primary/10"
                >
                  {t('mockInterview.startInterview')}
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Generate Interview Dialog */}
      <Dialog open={isGenerateOpen} onOpenChange={setIsGenerateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              {t('mockInterview.generateTitle', 'Generate AI Interview')}
            </DialogTitle>
            <DialogDescription>
              {t(
                'mockInterview.generateDesc',
                'Create a personalized interview based on your profile and preferences.',
              )}
            </DialogDescription>
          </DialogHeader>

          {isLoadingProfile ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-5">
              {/* Profile preview */}
              {profile && profile.skills && profile.skills.length > 0 && (
                <div className="p-4 rounded-xl bg-muted/50 border border-border">
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Briefcase className="w-4 h-4" />
                    {t('mockInterview.yourProfile', 'Your Profile')}
                  </h4>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {profile.skills.slice(0, 8).map((skill) => (
                      <Badge key={skill} variant="secondary" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                    {profile.skills.length > 8 && (
                      <Badge variant="outline" className="text-xs">
                        +{profile.skills.length - 8}
                      </Badge>
                    )}
                  </div>
                  {profile.experience && Array.isArray(profile.experience) && profile.experience.length > 0 && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {profile.experience.map(e => `${e.role} at ${e.company}`).join(' | ')}
                    </p>
                  )}
                </div>
              )}

              {/* Interview type selection */}
              <div className="space-y-2">
                <Label>{t('mockInterview.interviewType', 'Interview Type')}</Label>
                <Select value={interviewType} onValueChange={setInterviewType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['Technical', 'Behavioral', 'Mixed'].map((type) => {
                      const Icon = TYPE_ICONS[type] || Shuffle;
                      return (
                        <SelectItem key={type} value={type}>
                          <span className="flex items-center gap-2">
                            <Icon className="w-4 h-4" />
                            {type}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Target role */}
              <div className="space-y-2">
                <Label>{t('mockInterview.targetRole', 'Target Role')}</Label>
                <Input
                  placeholder={t(
                    'mockInterview.targetRolePlaceholder',
                    'e.g. Frontend Developer',
                  )}
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                />
              </div>

              {/* Language selection */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  Interview Language
                </Label>
                <Select value={interviewLang} onValueChange={setInterviewLang}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANG_OPTIONS.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value}>
                        <span className="flex items-center gap-2">
                          <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                            {lang.flag}
                          </span>
                          {lang.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Questions, interview, and feedback will be in this language
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsGenerateOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || isLoadingProfile}
              className="gap-2"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {isGenerating
                ? t('mockInterview.generating', 'Generating...')
                : t('mockInterview.generate', 'Generate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
