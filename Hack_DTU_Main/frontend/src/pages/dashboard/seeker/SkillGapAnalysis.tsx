import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useParams, useNavigate } from "react-router-dom";
import { AlertCircle, BookOpen, ArrowRight, ArrowLeft, Loader2, Award, Zap, Sparkles, Share2, Download, Target, PlayCircle, ExternalLink } from "lucide-react";
import { analyzeSkillGap } from '@/lib/auth-api';
import { useToast } from "@/hooks/use-toast";

interface CourseRecommendation {
  title: string;
  description: string;
  link: string;
  provider?: string;
  duration?: string;
  level?: string;
  institution?: string;
  isFree?: boolean;
  matchedSkills?: string[];
  reason?: string;
  matchScore?: number;
}

interface SkillGapResult {
  score: number;
  analysis: string;
  missingSkills: { name: string; category: string; importance: string }[];
  learningPath: CourseRecommendation[];
}

const PROVIDER_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  NPTEL: { bg: 'bg-blue-500/10', text: 'text-blue-600', label: 'NPTEL' },
  SWAYAM: { bg: 'bg-green-500/10', text: 'text-green-600', label: 'SWAYAM' },
  SkillIndia: { bg: 'bg-orange-500/10', text: 'text-orange-600', label: 'Skill India' },
  eSkillIndia: { bg: 'bg-purple-500/10', text: 'text-purple-600', label: 'eSkill India' },
  Udemy: { bg: 'bg-violet-500/10', text: 'text-violet-600', label: 'Udemy' },
};

export const SkillGapAnalysis = () => {
  const { t } = useTranslation();
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<SkillGapResult | null>(null);

  const [recommendedJobs, setRecommendedJobs] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
       const token = localStorage.getItem('authToken') || localStorage.getItem('idToken');
       if (!token) {
          toast({ title: t('skillGap.authError'), description: t('skillGap.pleaseLogin'), variant: "destructive" });
          return;
       }

       if (jobId) {
          setAnalyzing(true);
          try {
            const data = await analyzeSkillGap(token, jobId);
            setResult(data);
          } catch (error) {
            console.error(error);
            toast({ title: t('skillGap.analysisFailed'), description: t('skillGap.aiError'), variant: "destructive" });
          } finally {
            setAnalyzing(false);
          }
       } else {
          try {
             const { fetchRecommendedJobs } = await import('@/lib/auth-api');
             const jobs = await fetchRecommendedJobs(token);
             setRecommendedJobs(jobs.slice(0, 6)); // Top 6 recommendations
          } catch (error) {
             console.error("Failed to fetch jobs", error);
          }
       }
    };

    fetchData();
  }, [jobId]);

  // Case 1: No Job Selected - Show Recommendations
  if (!jobId) {
    return (
      <div className="max-w-6xl mx-auto py-2 space-y-6 animate-in fade-in duration-700">
        <div className="text-center space-y-4 relative">
           {/* Background Decoration */}
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-primary/20 blur-[100px] rounded-full -z-10" />
           
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary font-bold text-sm border border-primary/20 shadow-sm">
            <Sparkles className="w-4 h-4" />
            {t('skillGap.badge')}
          </div>
          
          <div>
            <h1 className="text-4xl md:text-5xl font-display font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 pb-2">
              {t('skillGap.title')}
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto mt-2 leading-relaxed">
              {t('skillGap.subtitle')} <br className="hidden md:block"/>
              {t('skillGap.selectRole')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4">
           {recommendedJobs.map((job) => (
              <Card key={job._id} className="group relative overflow-hidden border-slate-200 dark:border-slate-800 hover:border-primary/50 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/5 bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm">
                 <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                 
                 <CardHeader className="relative">
                    <div className="flex justify-between items-start gap-4">
                       <div>
                          <CardTitle className="line-clamp-1 text-xl group-hover:text-primary transition-colors">{job.title}</CardTitle>
                          <CardDescription className="line-clamp-1 text-base">{job.companyProfileId?.companyName || job.company || "Unknown Company"}</CardDescription>
                       </div>
                       <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-center p-1 shrink-0">
                           {job.companyProfileId?.logoUrl ? (
                              <img src={job.companyProfileId.logoUrl} alt="Logo" className="w-full h-full object-contain rounded-lg" />
                           ) : (
                              <div className="text-lg font-bold text-primary">{(job.companyProfileId?.companyName || job.company || "C").charAt(0)}</div>
                           )}
                       </div>
                    </div>
                 </CardHeader>
                 <CardContent className="relative flex-1 flex flex-col justify-end space-y-6">
                    <div className="space-y-3">
                       <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('skillGap.topSkillsRequired')}</p>
                       <div className="flex flex-wrap gap-2">
                          {job.skills?.slice(0, 3).map((skill: string, i: number) => (
                             <Badge key={i} variant="secondary" className="bg-slate-100 dark:bg-slate-800 hover:bg-white text-slate-700 dark:text-slate-300 border-transparent">{skill}</Badge>
                          ))}
                          {job.skills?.length > 3 && <Badge variant="outline" className="text-xs border-dashed">+{job.skills.length - 3}</Badge>}
                       </div>
                    </div>
                    <Button onClick={() => navigate(`/dashboard/skill-gap/${job._id}`)} className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90 group-hover:scale-[1.02] transition-all shadow-lg shadow-primary/20">
                       <Zap className="w-4 h-4 fill-current" />
                       {t('skillGap.analyzeSkillGap')}
                    </Button>
                 </CardContent>
              </Card>
           ))}
        </div>
      </div>
    );
  }

  // Case 2: Loading
  if (analyzing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent animate-pulse" />
        <div className="relative z-10">
          <div className="relative mx-auto w-24 h-24">
             <div className="absolute inset-0 border-4 border-slate-200 dark:border-slate-800 rounded-full" />
             <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin" />
             <Loader2 className="absolute inset-0 m-auto w-8 h-8 text-primary animate-pulse" />
          </div>
        </div>
        <div className="relative z-10 max-w-md space-y-2">
          <h2 className="text-3xl font-display font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-500">
             {t('skillGap.analyzingProfile')}
          </h2>
          <p className="text-muted-foreground text-lg">
             {t('skillGap.analyzingDesc')}
          </p>
        </div>
      </div>
    );
  }

  // Case 3: Error
  if (!result && !analyzing) {
     return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
           <div className="w-24 h-24 bg-red-50 dark:bg-red-900/10 rounded-full flex items-center justify-center mb-6">
              <AlertCircle className="w-10 h-10 text-red-500" />
           </div>
           <h3 className="text-xl font-bold mb-2">{t('skillGap.analysisUnavailable')}</h3>
           <p className="text-muted-foreground mb-6">{t('skillGap.analysisUnavailableDesc')}</p>
           <Button onClick={() => navigate(-1)} variant="outline">{t('skillGap.goBack')}</Button>
        </div>
     );
  }

  // Case 4: Success Result
  return (
    <div className="max-w-6xl mx-auto pb-20 space-y-12 animate-in slide-in-from-bottom-8 duration-700">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-border pb-8">
        <div>
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4 pl-0 hover:pl-2 transition-all gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> {t('skillGap.backToJobs')}
          </Button>
          <div className="flex items-center gap-3">
             <div className="p-3 bg-gradient-to-br from-primary to-purple-600 rounded-2xl shadow-lg shadow-primary/20 text-white">
                <Zap className="w-8 h-8 fill-white/20" />
             </div>
             <div>
                <h1 className="text-3xl md:text-4xl font-display font-bold">{t('skillGap.analysisReport')}</h1>
                <p className="text-muted-foreground">{t('skillGap.detailedBreakdown')}</p>
             </div>
          </div>
        </div>
        <div className="flex gap-3">
           <Button variant="outline" className="gap-2">
              <Share2 className="w-4 h-4" /> {t('skillGap.share')}
           </Button>
           <Button className="gap-2 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25">
              <Download className="w-4 h-4" /> {t('skillGap.downloadPdf')}
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Match Score Card */}
        <Card className="md:col-span-4 bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 border-primary/10 shadow-xl shadow-primary/5 overflow-hidden relative">
          <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-primary via-purple-500 to-primary" />
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl">{t('skillGap.matchScore')}</CardTitle>
            <CardDescription>{t('skillGap.basedOnAi')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-8 relative">
            {/* Custom SVG Gradient */}
            <svg style={{ width: 0, height: 0, position: 'absolute' }}>
               <defs>
                  <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                     <stop offset="0%" stopColor="hsl(var(--primary))" />
                     <stop offset="100%" stopColor="#a855f7" /> 
                  </linearGradient>
               </defs>
            </svg>
            
            <div className="relative flex items-center justify-center">
              {/* Glow Effect */}
              <div className={`absolute inset-0 rounded-full blur-3xl opacity-20 ${ (result?.score || 0) > 70 ? 'bg-green-500' : 'bg-primary'}`} />
              
              <svg className="w-48 h-48 transform -rotate-90 drop-shadow-2xl">
                <circle cx="96" cy="96" r="80" fill="transparent" stroke="currentColor" strokeWidth="12" className="text-slate-100 dark:text-slate-800" />
                <circle cx="96" cy="96" r="80" fill="transparent" stroke="url(#scoreGradient)" strokeWidth="12" strokeLinecap="round"
                  strokeDasharray={502}
                  strokeDashoffset={502 - (502 * (result?.score || 0)) / 100}
                  className="transition-all duration-[1500ms] ease-out"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                 <span className="text-5xl font-display font-bold tracking-tight">{result?.score}%</span>
                 <span className={`text-sm font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mt-2 ${
                    (result?.score || 0) > 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                    (result?.score || 0) > 50 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                 }`}>
                    {(result?.score || 0) > 80 ? t('skillGap.excellent') : (result?.score || 0) > 50 ? t('skillGap.good') : t('skillGap.poor')} Match
                 </span>
              </div>
            </div>
            <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl text-sm text-center leading-relaxed text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-slate-800">
              "{result?.analysis}"
            </div>
          </CardContent>
        </Card>

        {/* Missing Skills & Recommendations */}
        <div className="md:col-span-8 space-y-8">
           {/* Missing Skills */}
           <Card className="border-none shadow-none bg-transparent">
             <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center text-red-600 dark:text-red-400">
                   <Target className="w-5 h-5" />
                </div>
                <div>
                   <h3 className="text-xl font-bold">{t('skillGap.missingSkills')}</h3>
                   <p className="text-muted-foreground">{t('skillGap.prioritizeLearning')}</p>
                </div>
             </div>
             
             {result?.missingSkills.length === 0 ? (
                <div className="text-center py-12 bg-green-50 dark:bg-green-900/10 rounded-3xl border border-green-100 dark:border-green-900/20">
                   <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600">
                      <Sparkles className="w-8 h-8" />
                   </div>
                   <h4 className="text-lg font-bold text-green-700 dark:text-green-400">{t('skillGap.perfectMatch')}</h4>
                   <p className="text-green-600/80 dark:text-green-400/70">{t('skillGap.perfectMatchDesc')}</p>
                </div>
             ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   {result?.missingSkills.map((skill, index) => (
                      <div key={index} className="flex items-start gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-red-200 dark:hover:border-red-900/30 shadow-sm hover:shadow-md transition-all group">
                         <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${skill.importance === 'High' ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-yellow-500'}`} />
                         <div>
                            <div className="flex items-center gap-2">
                               <h4 className="font-bold text-foreground group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">{skill.name}</h4>
                               {skill.importance === 'High' && <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">{t('skillGap.highPriority')}</Badge>}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{skill.category} • {t('skillGap.expectedByIndustry')}</p>
                         </div>
                      </div>
                   ))}
                </div>
             )}
           </Card>

           {/* Learning Path */}
           {result?.learningPath && result.learningPath.length > 0 && (
              <div className="pt-4 animate-in slide-in-from-bottom-4 duration-1000 delay-200">
                 <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                       <BookOpen className="w-5 h-5" />
                    </div>
                    <div>
                       <h3 className="text-xl font-bold">{t('skillGap.learningPlan')}</h3>
                       <p className="text-muted-foreground">{t('skillGap.learningPlanDesc')}</p>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 gap-4">
                    {result.learningPath.map((item, idx) => {
                       const providerStyle = item.provider ? PROVIDER_STYLES[item.provider] : null;
                       return (
                       <a key={idx} href={item.link} target="_blank" rel="noopener noreferrer" className="group block">
                          <div className="flex flex-col sm:flex-row gap-6 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all">
                             <div className="w-full sm:w-48 h-32 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0 overflow-hidden relative flex flex-col items-center justify-center gap-2">
                                {providerStyle ? (
                                   <>
                                      <div className={`px-3 py-1 rounded-full text-xs font-bold ${providerStyle.bg} ${providerStyle.text}`}>
                                         {providerStyle.label}
                                      </div>
                                      {item.institution && (
                                         <span className="text-[10px] text-muted-foreground text-center px-2">{item.institution}</span>
                                      )}
                                      {item.isFree ? (
                                         <Badge variant="secondary" className="text-[10px] bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400">FREE</Badge>
                                      ) : item.provider === 'Udemy' ? (
                                         <Badge variant="secondary" className="text-[10px] bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-400">PAID</Badge>
                                      ) : null}
                                   </>
                                ) : (
                                   <PlayCircle className="w-10 h-10 text-slate-300 dark:text-slate-700" />
                                )}
                                {item.matchScore != null && (
                                   <div className={`absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                                      item.matchScore >= 70 ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' :
                                      item.matchScore >= 40 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400' :
                                      'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                   }`}>
                                      {item.matchScore}% match
                                   </div>
                                )}
                                <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                             </div>
                             <div className="flex-1 flex flex-col justify-between py-1">
                                <div>
                                   <div className="flex justify-between items-start">
                                      <h4 className="text-lg font-bold group-hover:text-primary transition-colors line-clamp-1">{item.title}</h4>
                                      <ExternalLink className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors shrink-0" />
                                   </div>
                                   {item.reason && (
                                      <div className="flex items-start gap-1.5 mt-2 p-2 rounded-lg bg-primary/5 border border-primary/10">
                                         <Sparkles className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                                         <p className="text-xs text-primary/80 leading-relaxed">{item.reason}</p>
                                      </div>
                                   )}
                                   <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{item.description}</p>
                                   <div className="flex flex-wrap items-center gap-2 mt-3">
                                      {item.duration && (
                                         <span className="text-xs text-muted-foreground bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">{item.duration}</span>
                                      )}
                                      {item.level && (
                                         <span className="text-xs text-muted-foreground bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">{item.level}</span>
                                      )}
                                      {item.matchedSkills && item.matchedSkills.length > 0 && (
                                         item.matchedSkills.map((sk, i) => (
                                            <Badge key={i} className="text-[10px] capitalize bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 border-red-200 dark:border-red-900/30">Gap: {sk}</Badge>
                                         ))
                                      )}
                                   </div>
                                </div>
                                <div className="mt-4 flex items-center gap-2 text-sm font-medium text-primary">
                                   {t('skillGap.startLearning')} <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                                </div>
                             </div>
                          </div>
                       </a>
                       );
                    })}
                 </div>

                 {/* Show skills that have no course recommendation */}
                 {(() => {
                    const coveredSkills = new Set(
                       (result.learningPath || []).flatMap((c) => c.matchedSkills || []).map((s) => s.toLowerCase())
                    );
                    const uncoveredSkills = (result.missingSkills || []).filter(
                       (s) => !coveredSkills.has(s.name.toLowerCase())
                    );
                    if (uncoveredSkills.length === 0) return null;
                    return (
                       <div className="mt-6 p-4 rounded-xl bg-muted/50 border border-border">
                          <p className="text-sm font-medium mb-2">No matching government course found for:</p>
                          <div className="flex flex-wrap gap-2">
                             {uncoveredSkills.map((s, i) => (
                                <Badge key={i} variant="outline" className="text-xs">{s.name}</Badge>
                             ))}
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                             These skills are not yet covered in the NPTEL/SWAYAM/Skill India catalog.
                             Try searching for them on skillindiadigital.gov.in or swayam.gov.in directly.
                          </p>
                       </div>
                    );
                 })()}
              </div>
           )}
        </div>
      </div>
    </div>
  );
};
