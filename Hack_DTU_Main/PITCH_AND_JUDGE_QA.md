# YuvaSetu - Complete Pitch, PS Alignment & Judge Q&A

---

## 1. THE PITCH (3-Minute Version)

### The Problem

India produces 1.5 crore graduates every year. 80% of them can't afford interview coaching (Rs 5,000-50,000/session). Tier-2/3 students have zero access to mock interviews, no feedback on why they fail, and no connection between their skills and available jobs. Meanwhile, employers waste weeks screening mismatched candidates manually.

### What is YuvaSetu?

YuvaSetu is an **AI-powered career platform** that connects job seekers with opportunities through intelligent matching, voice-based AI interview practice, real-time proctoring, and personalized skill development — all in **Hindi, Marathi, and English**.

### How It Works

```
Job Seeker Journey:
  Upload Resume → AI parses & builds profile → Semantic job matching
       ↓
  See matched jobs → Analyze skill gaps → Get free government courses (NPTEL/SWAYAM)
       ↓
  Practice AI mock interview (voice, in your language) → Get scored feedback
       ↓
  Apply with confidence → Track applications

Employer Journey:
  Post job → AI ranks candidates by fit → View match scores → Hire
```

### The AI Systems

We use **6 distinct AI systems** working together:

| # | System | What It Does |
|---|--------|-------------|
| 1 | **Ollama (Gemma3 4B)** | Local LLM for real-time voice interviews — runs on device, no cloud cost, private |
| 2 | **Google Gemini Embeddings** | Generates 768-dim vectors for semantic job matching and skill comparison |
| 3 | **Whisper STT** | Transcribes candidate speech in English, Hindi, Marathi |
| 4 | **Edge TTS** | AI voice output — 3 Indian voices for natural conversation |
| 5 | **face-api.js** | Real-time face detection + proctoring during interviews |
| 6 | **OnDemand GPT-4o** | Resume parsing + skill gap explanation + Udemy course search |

### Live Demo Script

1. **Show resume upload** → AI extracts structured data in seconds
2. **Show job matching** → Top jobs ranked by 78% skill match
3. **Show skill gap** → "You're missing React and Docker" → NPTEL course recommended + Udemy fallback
4. **Start Hindi interview** → AI greets in Hindi, asks questions, responds to voice
5. **Trigger proctoring** → Look away → Yellow warning. Switch tab → Strike 2. Show integrity report.
6. **Show feedback** → 5-category scoring with strengths/improvements

### Why YuvaSetu Wins

| Others | YuvaSetu |
|--------|---------|
| English only | Hindi, Marathi, English — voice + UI |
| Cloud-dependent interviews | Local LLM — free, private, no API cost |
| No proctoring | Face detection + eye tracking + tab monitoring |
| Generic courses | Real NPTEL/SWAYAM courses matched to YOUR skill gaps |
| Separate tools | One platform: matching → gaps → courses → interview → feedback |

---

## 2. PROBLEM STATEMENT ALIGNMENT

### PS 01: Next-Gen Generative AI

> *"Build transformative tools using LLMs or multimodal AI to democratize education, automate workflows, or bridge language barriers."*

### Mandate 1: Democratize Education

| What We Do | How |
|------------|-----|
| Free AI interview coaching | Ollama runs locally — no cloud API costs. Every student gets unlimited practice |
| Personalized skill development | Skill gap analysis identifies exact missing skills, recommends free govt courses |
| Accessible mock tests | 300+ MCQs from 24+ companies (TCS, Infosys, Meta, etc.) — free |
| No coaching fee barrier | Traditional coaching: Rs 5,000-50,000. YuvaSetu: Rs 0 |

**SDG 4 (Quality Education)**: Free, AI-powered interview coaching available to any student with a laptop.

### Mandate 2: Automate Workflows

| What We Automate | How |
|-----------------|-----|
| Resume parsing | Upload PDF → AI extracts structured profile in 3 seconds |
| Job matching | Semantic embeddings match candidate to 50+ jobs in <1 second |
| Interview scoring | AI scores across 5 categories — no manual evaluation needed |
| Skill gap detection | Vector comparison identifies missing skills automatically |
| Course recommendation | Missing skills → keyword match across 237 courses → instant recommendations |

**SDG 8 (Decent Work)**: AI-powered matching connects the right candidate to the right job efficiently.

### Mandate 3: Bridge Language Barriers

| What We Bridge | How |
|----------------|-----|
| Platform UI | 1,140 translation keys in English, Hindi, Marathi |
| Voice interviews | AI conducts interviews in Hindi/Marathi with native TTS voices |
| Speech recognition | Whisper STT transcribes Hindi/Marathi speech accurately |
| Interview feedback | Scoring and feedback generated in the candidate's chosen language |
| Course access | Skill India courses available in Hindi |

**SDG 10 (Reduced Inequalities)**: A candidate in Nagpur can practice interviews in Marathi. A student in Patna can hear AI questions in Hindi.

### AI Usage Map

```
                    ┌─────────────────────────────────┐
                    │         YuvaSetu AI Core          │
                    │                                   │
  ┌─────────────┐   │   ┌───────────┐  ┌────────────┐  │
  │ Resume      │───┼──→│ OnDemand  │  │ Gemini     │  │
  │ Upload      │   │   │ GPT-4o    │  │ Embeddings │  │
  └─────────────┘   │   └───────────┘  └─────┬──────┘  │
                    │                         │         │
  ┌─────────────┐   │   ┌───────────┐         │         │
  │ Job         │───┼──→│ MongoDB   │←────────┘         │
  │ Matching    │   │   │ Vector    │                    │
  └─────────────┘   │   │ Search    │                    │
                    │   └───────────┘                    │
  ┌─────────────┐   │                                   │
  │ Skill Gap   │───┼──→ Cosine Similarity + GPT-4o     │
  │ Analysis    │   │   + Course Matching + Udemy API    │
  └─────────────┘   │                                   │
                    │   ┌───────────┐  ┌────────────┐   │
  ┌─────────────┐   │   │ Whisper   │  │ Edge TTS   │   │
  │ Mock        │───┼──→│ STT      │──│ Speech     │   │
  │ Interview   │   │   └───────────┘  └────────────┘   │
  └─────────────┘   │         ↑                         │
                    │   ┌─────┴───────┐                  │
  ┌─────────────┐   │   │ Ollama     │                  │
  │ Proctoring  │───┼──→│ Gemma3 4B  │ (Local LLM)     │
  │ System      │   │   └─────────────┘                  │
  └─────────────┘   │         ↑                         │
                    │   ┌─────┴───────┐                  │
                    │   │ face-api.js │ (Vision)         │
                    │   └─────────────┘                  │
                    └─────────────────────────────────┘
```

---

## 3. JUDGE Q&A — 30 QUESTIONS WITH ANSWERS

### Architecture & Technical

**Q1: "What's your tech stack?"**
> React 18 + TypeScript + Vite (frontend), Express.js + TypeScript + MongoDB Atlas (backend), Python Flask (STT/TTS services), Ollama (local LLM). 28,000 lines of code, 43 API endpoints, 134 React components, 8 database models.

**Q2: "How does your job matching actually work?"**
> Three-phase pipeline: (1) Gemini Embeddings generate 768-dimension vectors for both candidates and jobs — skills, experience, and role description separately. (2) MongoDB Atlas Vector Search retrieves top 100 nearest neighbours in O(log N). (3) In-memory reranking using weighted cosine similarity: Skills 50% + Experience 30% + Role Fit 20%. Top 10 returned.

**Q3: "What happens if Ollama isn't running?"**
> The interview won't start. The readiness page performs health checks on all 3 services (STT, TTS, LLM) before allowing the candidate to begin. If any service is down, the start button stays disabled with a clear error. The rest of the platform (job matching, applications, profile) works independently.

**Q4: "How is this different from just using ChatGPT?"**
> Three things: (1) **Local execution** — Ollama runs on-device, no data sent to cloud. (2) **Structured interview** — follows a real format with dynamic follow-ups, not freeform chat. (3) **Integrated platform** — proctoring monitors behaviour, scoring evaluates across 5 categories, and skill gaps connect directly to courses. ChatGPT does none of this.

**Q5: "Your resume parser just sends text to GPT-4o. What's YOUR contribution?"**
> The parser is actually hybrid. Step 1: PDF.js extracts text with spatial positioning. Step 2: Regex-based deterministic parser extracts contacts, education, experience, skills — this works WITHOUT any API. Step 3: OnDemand GPT-4o enhances the extraction when available. Step 4: Hybrid merge combines both results. Our contribution is the pipeline, confidence scoring, and fallback strategy — not just an API call.

**Q6: "What's the latency of your interview pipeline?"**
> STT (Whisper): 0.8-1.5s. LLM (Ollama Gemma3 4B on CPU): 2-5s. TTS (Edge TTS, parallel per sentence): 0.3-0.6s per sentence. Total first-audio latency: 5-8 seconds from when the user stops speaking. This is comparable to a human thinking before responding.

### AI & ML Specific

**Q7: "Is face-api.js really AI?"**
> face-api.js uses a TinyFaceDetector (convolutional neural network) and a 68-point FaceLandmark network — these are real neural networks, pre-trained on face datasets. Our contribution is the gaze estimation algorithm built on top: we analyse nose-jaw ratios for head pose and canvas pixel brightness for iris detection. The detection is ML, the analysis is custom heuristics.

**Q8: "Your skill gap scoring is just cosine similarity — how is that AI?"**
> The scoring is intentionally deterministic (cosine similarity on embeddings). We believe scoring should be **reproducible and explainable**, not hallucinated by an LLM. The AI's role is to **explain** the score, not calculate it. This design was deliberate — we anchor the AI to mathematical truth to avoid the "GPT gave me 85% yesterday and 60% today for the same profile" problem.

**Q9: "Gemma3 4B is a tiny model. How good are the interview responses?"**
> For structured interview Q&A, Gemma3 4B performs well — it follows the system prompt reliably, asks one question at a time, and gives contextual follow-ups. It's not GPT-4 quality, but the tradeoff is intentional: (1) free for users, (2) private — no data leaves the machine, (3) works offline after setup. For a mock interview where the goal is practice, this quality level is appropriate.

**Q10: "How do you handle hallucination in feedback scoring?"**
> We don't trust the LLM for scoring. The feedback generator sends the full transcript to Gemma3 with strict JSON schema requirements and score ranges (0-100). We parse the JSON, validate ranges, and calculate the total as the mathematical average. If parsing fails, we return "Cannot be determined" with generic feedback. The LLM generates the narrative, but the numbers are validated programmatically.

### Multilingual

**Q11: "Is this real translation or just i18n?"**
> Both. The UI uses i18next with 1,140 translated keys per language — these are static, human-quality translations. The interview AI uses **prompt-based language switching**: the system prompt says "Conduct this interview in Hindi." Ollama follows the instruction and responds in natural Hindi/Hinglish. This is how multilingual LLM applications work in production — it's not Google Translate, it's native generation.

**Q12: "Can you demo a Hindi interview right now?"**
> Yes. Generate an interview with "Hindi" selected → questions generated in Hindi. Start interview → AI greets "Namaste, main aapka interviewer Alex hoon." → Whisper transcribes Hindi speech with `language="hi"` → Ollama responds in Hindi → Edge TTS speaks with `hi-IN-SwaraNeural` voice → Feedback generated in Hindi.

**Q13: "How complete are your Hindi/Marathi translations?"**
> 1,140 keys in each language. All core user flows — login, dashboard, job search, skill gap, interview, feedback — are fully translated. The language switcher is instant with no page reload.

### Proctoring

**Q14: "What violations does your proctoring detect?"**
> Four types: (1) **No face** — camera covered or walked away (2s grace period). (2) **Multiple faces** — someone helping. (3) **Tab switch** — browser visibilitychange API, 100% accurate. (4) **Window blur** — alt-tabbed to another app. Each generates a timestamped violation with confidence score.

**Q15: "What happens when someone is terminated?"**
> 3-strike system: Strike 1 → yellow warning banner. Strike 2 → orange warning. Strike 3 → red banner + interview auto-terminates. The feedback is saved to the database with `terminated: true` flag and full violation timeline. The integrity report shows on the feedback page with violation breakdown.

**Q16: "Can't someone just cover the camera?"**
> That triggers a "no face detected" violation after 2 seconds. The interview can't proceed normally without a visible face. If they cover it repeatedly, they'll hit 3 strikes and get terminated. The violation log is saved permanently.

### Course Recommendations

**Q17: "Where do your courses come from?"**
> Three sources: (1) **NPTEL** — 119 courses scraped live with BeautifulSoup from nptel.ac.in. (2) **SWAYAM** — 111 courses extracted from embedded JSON on swayam.gov.in. (3) **Skill India** — 7 curated entries linking to the government portal. Total: 237 courses with Gemini embeddings. When none match, **Udemy** serves as a fallback via OnDemand's agent tool.

**Q18: "How do you match courses to skill gaps?"**
> Keyword-first matching: exact skill in course tags (+50 points), skill phrase in title (+40), in description (+15), individual word matches (+20 if >50% hit). Minimum threshold of 15 points. If no local course matches above threshold, we query Udemy via OnDemand API. Uncovered skills shown transparently with a "no government course found" message.

**Q19: "Why not just use Google search links?"**
> That's what we replaced. Google links are generic, unreliable, and not curated. Our approach gives direct links to verified government courses (NPTEL, SWAYAM) with provider badges, duration, institution, and explainable reasons for each recommendation. The "why this course" transparency is something Google can't provide.

### Scalability & Production

**Q20: "This runs on localhost. How would you deploy this?"**
> All localhost URLs are now environment variables (`VITE_API_URL`, `VITE_EDGE_TTS_URL`, `VITE_WHISPER_STT_URL`). Backend deploys on any Node.js host (Railway, Render, AWS). STT/TTS Flask servers containerize with Docker. Ollama runs on a GPU server or falls back to cloud LLM API. MongoDB Atlas is already cloud-hosted.

**Q21: "What about concurrent users? Can 100 people interview simultaneously?"**
> Current architecture: each interview session is independent (separate Ollama request, separate audio streams). The bottleneck is Ollama — Gemma3 4B on CPU handles 1-2 concurrent requests. For 100 users: deploy Ollama on GPU (10x throughput) or switch to a cloud LLM API (Groq, Together AI) for the interview endpoint.

**Q22: "Your course recommendation loads all 237 courses for every request."**
> For 237 courses, this is fine (<10ms). At 10,000+ courses, we'd add MongoDB text indexes for keyword search and use `$text` queries instead of in-memory filtering. The architecture supports this — just change `Course.find()` to `Course.find({ $text: { $search: skillName } })`.

### Security

**Q23: "Are your API keys secure?"**
> Backend API keys are in `.env` files (not committed to git). Frontend uses Vite environment variables prefixed with `VITE_` for Firebase config (which is designed to be client-side). The OnDemand, Gemini, and OpenAI keys are server-side only.

**Q24: "What authentication do you use?"**
> Firebase Authentication with Google OAuth and email/password. Backend validates Firebase ID tokens via firebase-admin SDK. All protected routes go through `authenticateUser` middleware. Rate limiting on login (5 attempts/minute).

### Impact & SDG

**Q25: "How does this reduce inequality?"**
> Three ways: (1) **Economic** — free AI coaching vs Rs 5,000-50,000 paid coaching. (2) **Geographic** — a student in a village can practice interviews if they have internet. (3) **Linguistic** — Hindi/Marathi speakers aren't forced into English-only platforms.

**Q26: "What's your user validation?"**
> This is a hackathon prototype. The validation is the technical demonstration: the pipeline works end-to-end from resume upload to interview feedback. For production, we'd need: user studies with tier-2/3 students, A/B testing interview quality, and employer adoption metrics.

**Q27: "How is this sustainable? Who pays?"**
> The core AI runs locally (Ollama = free). The platform uses free tiers: MongoDB Atlas free tier, Firebase free tier, Gemini API free tier. Premium features (priority job matching, more interviews, employer analytics) would be the monetization path. Government partnerships with Skill India/NSDC for course integration are the distribution strategy.

### Honest Limitations

**Q28: "What doesn't work yet?"**
> (1) Course recommendations depend on our 237-course catalog — niche skills may not have matches. (2) Ollama on CPU has 5-8s latency per response. (3) Proctoring has reduced gaze detection (relaxed for usability). (4) No email notifications yet. (5) Employer-side analytics are basic.

**Q29: "What would you build next with more time?"**
> (1) GPU-accelerated Ollama for <1s responses. (2) Live NPTEL/SWAYAM scraping on a cron schedule. (3) Employer dashboard with proctoring violation reports. (4) Video interview recording for employer review. (5) WhatsApp bot for interview practice (reach tier-3 users).

**Q30: "If a judge had to pick one thing to demo, what should it be?"**
> The Hindi mock interview with proctoring. It demonstrates all 3 PS mandates in 60 seconds: education (AI coaching), language (Hindi conversation), and automation (scoring + integrity report). No other hackathon project lets you talk to an AI interviewer in Hindi while it monitors you with face detection.

---

## 4. TECHNICAL SPECIFICATIONS

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React 18 + Vite)                │
│  134 components │ 38 pages │ 1,140 i18n keys × 3 languages      │
│  face-api.js proctoring │ Socket.IO client │ Firebase Auth       │
└──────────────────────────┬──────────────────────────────────────┘
                           │ REST API + WebSocket
┌──────────────────────────┴──────────────────────────────────────┐
│                     BACKEND (Express.js + TypeScript)             │
│  43 API endpoints │ 8 Mongoose models │ Firebase Admin Auth      │
│  Gemini Embeddings │ OnDemand AI │ Course Recommendation Engine  │
└────────┬─────────────────┬──────────────────┬───────────────────┘
         │                 │                  │
┌────────┴───────┐ ┌───────┴────────┐ ┌──────┴───────┐
│ MongoDB Atlas  │ │ Ollama (Local) │ │ Python Flask │
│ Vector Search  │ │ Gemma3:4b LLM  │ │ STT + TTS    │
│ 8 collections  │ │ gemma3:4b      │ │ Whisper+Edge │
└────────────────┘ └────────────────┘ └──────────────┘
```

### Codebase Stats

| Metric | Count |
|--------|-------|
| Total lines of code | ~28,000 |
| Backend TypeScript | 3,965 lines |
| Frontend TSX/TS | 24,005 lines |
| Python (AI services) | ~600 lines |
| API endpoints | 43 |
| React components | 134 |
| Database models | 8 |
| Translation keys | 1,140 × 3 languages |
| Scraped courses | 237 (NPTEL + SWAYAM + Skill India) |
| AI systems integrated | 6 |

### Database Collections

| Collection | Purpose | Key Feature |
|------------|---------|-------------|
| users | Authentication | Firebase UID linked |
| jobseekerprofiles | Candidate data | 768-dim vector embeddings |
| jobs | Job listings | Vector search indexed |
| courses | Government courses | Keyword + embedding search |
| interviews | Interview sessions | Language-aware, question bank |
| interviewfeedbacks | Scoring data | 5-category + proctoring + terminated flag |
| companyprofiles | Employer info | Logo, description |
| mocktest_data | Practice MCQs | 300+ questions, 24+ companies |

---

## 5. DEMO SCRIPT (For Judges)

### Setup (Before Demo)
- All services running (backend, frontend, Ollama, STT, TTS)
- Test account logged in
- A job posting with skill requirements ready

### Demo Flow (5 minutes)

**Minute 1: The Problem**
> "80% of Indian graduates can't afford interview coaching. YuvaSetu solves this."

**Minute 2: Resume → Job Matching**
- Upload resume PDF → Show AI parsing in 3 seconds
- Navigate to dashboard → Show top matched jobs with % scores
- Click one → Show skill gap analysis with missing skills

**Minute 3: Skill Gap → Course Recommendations**
- Show missing skills identified by AI
- Show recommended NPTEL/SWAYAM courses with "why this course" explanation
- Show Udemy fallback for uncovered skills
- Point out: "These are free government courses, not Google links"

**Minute 4: Hindi Mock Interview + Proctoring**
- Generate interview in Hindi
- Start interview → Show readiness page with system checks
- AI greets in Hindi → Answer one question
- Look away → Yellow warning appears
- Switch tab → Strike 2
- End interview → Show 5-category feedback in Hindi

**Minute 5: The Impact**
- Show integrity report with violation timeline
- Switch to employer view → Show AI-ranked candidates
- "One platform: Resume → Matching → Skills → Courses → Interview → Feedback"
- "Free. Multilingual. AI-proctored. Built with 6 AI systems."

---

*Built for Hack DTU — PS 01: Next-Gen Generative AI*
*Team: Joy Banerjee*
