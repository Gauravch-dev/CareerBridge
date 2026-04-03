import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { OnboardingProvider } from "@/contexts/OnboardingContext";
import Index from "./pages/Index";
import About from "./pages/About";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import { OnboardingLayout } from "./pages/onboarding/OnboardingLayout";
import { OnboardingChoice } from "./pages/onboarding/OnboardingChoice";
import { ResumeUpload } from "./pages/onboarding/ResumeUpload";
import { MultiStepForm } from "./pages/onboarding/MultiStepForm";
import ScrollToTop from "./components/ScrollToTop";
import { DashboardLayout } from "./components/dashboard/DashboardLayout";
import { SeekerDashboard } from "./pages/dashboard/seeker/SeekerDashboard";
import { EmployerDashboard } from "./pages/dashboard/employer/EmployerDashboard";
import { EmployerLayout } from "./pages/dashboard/employer/EmployerLayout";
import { PostJob } from "./pages/dashboard/employer/PostJob";
import { Candidates } from "./pages/dashboard/employer/Candidates";
import { CompanyProfile } from "./pages/dashboard/employer/CompanyProfile";
import { EmployerSettings } from "./pages/dashboard/employer/EmployerSettings";
import { MyPostings } from "./pages/dashboard/employer/MyPostings";
import { JobPostingDetail } from "./pages/dashboard/employer/JobPostingDetail";
import { CandidateProfile } from "./pages/dashboard/employer/CandidateProfile";
import { VisualCandidatesDemo } from "./pages/dashboard/employer/VisualCandidatesDemo";


import { Applications } from "./pages/dashboard/seeker/Applications";
import { Upskill } from "./pages/dashboard/seeker/Upskill";
import { MockInterview } from "./pages/dashboard/seeker/MockInterview";
import { InterviewSession } from "./pages/dashboard/seeker/InterviewSession";
import { InterviewFeedback } from "./pages/dashboard/seeker/InterviewFeedback";
import { InterviewHistory } from "./pages/dashboard/seeker/InterviewHistory";
import { InterviewReadiness } from "./pages/dashboard/seeker/InterviewReadiness";
import { UserProfile } from "./pages/dashboard/seeker/UserProfile";
import { SeekerSettings } from "./pages/dashboard/seeker/SeekerSettings";
import { SkillGapAnalysis } from "./pages/dashboard/seeker/SkillGapAnalysis";
import { JobApplication } from "./pages/dashboard/seeker/JobApplication";
import { ApplicationDetails } from "./pages/dashboard/seeker/ApplicationDetails";


import { SocketProvider } from "./context/SocketContext";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <SocketProvider>
          <TooltipProvider>
            <OnboardingProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <ScrollToTop />
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/demo-candidates" element={<VisualCandidatesDemo />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/login/:userType" element={<Login />} />

                  {/* Onboarding Routes */}
                  <Route path="/onboarding" element={<OnboardingLayout />}>
                    <Route index element={<OnboardingChoice />} />
                    <Route path="upload" element={<ResumeUpload />} />
                    <Route path="form" element={<MultiStepForm />} />
                  </Route>

                  {/* Dashboard Routes */}
                  <Route path="/dashboard" element={<DashboardLayout />}>
                    <Route index element={<SeekerDashboard />} />
                    <Route path="jobs/:jobId/apply" element={<JobApplication />} />
                    <Route path="applications" element={<Applications />} />
                    <Route path="applications/:id" element={<ApplicationDetails />} />

                    <Route path="skill-gap" element={<SkillGapAnalysis />} />
                    <Route path="skill-gap/:jobId" element={<SkillGapAnalysis />} />
                    <Route path="upskill" element={<Upskill />} />
                    <Route path="mock-interview" element={<MockInterview />} />
                    <Route path="interview/:id/ready" element={<InterviewReadiness />} />
                    <Route path="interview/:id" element={<InterviewSession />} />
                    <Route path="interview/:id/feedback" element={<InterviewFeedback />} />
                    <Route path="interview-history" element={<InterviewHistory />} />
                    <Route path="profile" element={<UserProfile />} />
                    <Route path="settings" element={<SeekerSettings />} />

                    <Route path="employer" element={<EmployerLayout />}>
                      <Route index element={<EmployerDashboard />} />
                      <Route path="post-job" element={<PostJob />} />
                      <Route path="postings" element={<MyPostings />} />
                      <Route path="postings/:id" element={<VisualCandidatesDemo />} />
                      <Route path="candidate/:id" element={<CandidateProfile />} />
                      <Route path="profile" element={<CompanyProfile />} />
                      <Route path="settings" element={<EmployerSettings />} />
                    </Route>
                  </Route>
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </OnboardingProvider>
          </TooltipProvider>
        </SocketProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </HelmetProvider>
);

export default App;
