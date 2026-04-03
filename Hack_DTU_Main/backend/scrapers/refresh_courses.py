"""
Course Catalog Refresh — Production Orchestrator

Combines:
  1. NPTEL scraper (BeautifulSoup)
  2. SWAYAM scraper (BeautifulSoup + embedded JSON)
  3. Skill India / eSkill India curated catalog (manual, no scraping)

Generates Gemini embeddings for each course and writes to MongoDB.

Usage:
  python scrapers/refresh_courses.py                    # Full refresh
  python scrapers/refresh_courses.py --skip-scrape      # Curated only (fast)
  python scrapers/refresh_courses.py --nptel-only       # NPTEL + curated
  python scrapers/refresh_courses.py --swayam-only      # SWAYAM + curated
"""

import os
import sys
import argparse
import time
import logging
from datetime import datetime
from dotenv import load_dotenv
from pymongo import MongoClient

# Load env from backend/.env
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

# Add parent dir to path for imports
sys.path.insert(0, os.path.dirname(__file__))

from nptel_scraper import scrape_nptel
from swayam_scraper import scrape_swayam

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

# ─── Gemini Embedding ───────────────────────────────────────────────

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
_genai = None
_model = None


def init_gemini():
    global _genai, _model
    if not GEMINI_API_KEY:
        logger.warning("GEMINI_API_KEY not set — embeddings will be skipped")
        return False
    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)
        _model = genai.GenerativeModel("gemini-embedding-001")
        _genai = genai
        logger.info("Gemini embedding model initialized")
        return True
    except Exception as e:
        logger.error("Failed to init Gemini: %s", e)
        return False


def generate_embedding(text: str, retries: int = 3) -> list[float] | None:
    if not _genai or not text.strip():
        return None
    for attempt in range(retries):
        try:
            result = _genai.embed_content(
                model="models/gemini-embedding-001",
                content=text,
            )
            values = result.get("embedding", [])
            return values[:768] if values else None
        except Exception as e:
            err_str = str(e)
            if "429" in err_str and attempt < retries - 1:
                wait = (attempt + 1) * 15  # 15s, 30s, 45s
                logger.info("Rate limited — waiting %ds before retry...", wait)
                time.sleep(wait)
            else:
                logger.warning("Embedding failed: %s", err_str[:100])
                return None
    return None


# ─── Curated Courses (Skill India + eSkill India) ───────────────────

CURATED_COURSES = [
    # ─── SWAYAM (verified URLs from onlinecourses.swayam2.ac.in) ───
    {"title": "Python 3.4.3", "provider": "SWAYAM", "url": "https://onlinecourses.swayam2.ac.in/aic20_sp33/preview", "skills": ["Python", "Programming", "Software Development"], "duration": "15 weeks", "level": "Beginner", "language": "English", "institution": "IIT Bombay", "description": "Complete Python programming course covering fundamentals, data structures, OOP, file handling, and practical coding exercises."},
    {"title": "Python 3.4.3 (Hindi)", "provider": "SWAYAM", "url": "https://onlinecourses.swayam2.ac.in/aic20_sp44/preview", "skills": ["Python", "Programming", "Software Development"], "duration": "15 weeks", "level": "Beginner", "language": "Hindi", "institution": "IIT Bombay", "description": "Complete Python programming course in Hindi covering fundamentals, data structures, OOP, file handling."},
    {"title": "Advanced C++", "provider": "SWAYAM", "url": "https://onlinecourses.swayam2.ac.in/aic20_sp01/preview", "skills": ["C++", "Programming", "OOP", "Data Structures"], "duration": "12 weeks", "level": "Intermediate", "language": "English", "institution": "IIT Bombay", "description": "Advanced C++ programming covering STL, templates, memory management, multithreading, and design patterns."},
    {"title": "Android App using Kotlin", "provider": "SWAYAM", "url": "https://onlinecourses.swayam2.ac.in/aic20_sp02/preview", "skills": ["Android", "Kotlin", "Mobile Development", "App Development"], "duration": "12 weeks", "level": "Intermediate", "language": "English", "institution": "IIT Bombay", "description": "Build Android applications using Kotlin, Android Studio, UI components, APIs, and Google Play Store publishing."},
    {"title": "Arduino", "provider": "SWAYAM", "url": "https://onlinecourses.swayam2.ac.in/aic20_sp04/preview", "skills": ["Arduino", "IoT", "Embedded Systems", "Electronics", "Hardware"], "duration": "12 weeks", "level": "Beginner", "language": "English", "institution": "IIT Bombay", "description": "Learn Arduino programming, sensor interfacing, actuators, serial communication, and IoT project development."},
    {"title": "Blockchain", "provider": "SWAYAM", "url": "https://onlinecourses.swayam2.ac.in/aic21_ge01/preview", "skills": ["Blockchain", "Cryptocurrency", "Smart Contracts", "Web3"], "duration": "12 weeks", "level": "Intermediate", "language": "English", "institution": "IIT Bombay", "description": "Introduction to blockchain technology covering distributed ledgers, consensus mechanisms, smart contracts, and decentralized applications."},
    {"title": "C and C++", "provider": "SWAYAM", "url": "https://onlinecourses.swayam2.ac.in/aic20_sp06/preview", "skills": ["C Programming", "C++", "Programming", "Data Structures"], "duration": "12 weeks", "level": "Beginner", "language": "English", "institution": "IIT Bombay", "description": "Fundamentals of C and C++ programming including variables, control flow, functions, arrays, pointers, OOP concepts."},
    {"title": "Drupal - Content Management System", "provider": "SWAYAM", "url": "https://onlinecourses.swayam2.ac.in/aic20_sp07/preview", "skills": ["Drupal", "CMS", "Web Development", "PHP"], "duration": "12 weeks", "level": "Intermediate", "language": "English", "institution": "IIT Bombay", "description": "Build and manage websites using Drupal CMS covering modules, themes, content types, views, and site administration."},
    {"title": "AI for Daily Productivity", "provider": "SWAYAM", "url": "https://onlinecourses.swayam2.ac.in/nou26_ge63/preview", "skills": ["AI", "Productivity", "ChatGPT", "Automation"], "duration": "Self-paced", "level": "Beginner", "language": "English", "institution": "IGNOU", "description": "Learn to use AI tools for daily productivity — ChatGPT, image generation, automation, summarization, and content creation."},
    {"title": "Financial Literacy", "provider": "SWAYAM", "url": "https://onlinecourses.swayam2.ac.in/nou25_mg27/preview", "skills": ["Finance", "Financial Literacy", "Investment", "Budgeting", "Banking"], "duration": "Self-paced", "level": "Beginner", "language": "English", "institution": "IGNOU", "description": "Covers personal finance fundamentals, budgeting, savings, investment options, insurance, banking, and financial planning."},
    {"title": "Digital Literacy", "provider": "SWAYAM", "url": "https://onlinecourses.swayam2.ac.in/nou25_ed47/preview", "skills": ["Digital Literacy", "Computer Basics", "Internet", "MS Office"], "duration": "Self-paced", "level": "Beginner", "language": "English", "institution": "IGNOU", "description": "Basic digital skills including computer operations, internet usage, email, MS Office, online safety, and government e-services."},
    {"title": "Ancient Indian Management", "provider": "SWAYAM", "url": "https://onlinecourses.swayam2.ac.in/aic22_ge19/preview", "skills": ["Management", "Leadership", "Business", "Indian Philosophy"], "duration": "12 weeks", "level": "Beginner", "language": "English", "institution": "Taxila Business School", "description": "Management principles from ancient Indian texts — Arthashastra, Vedas, Bhagavad Gita — applied to modern business leadership."},
    {"title": "Moodle Learning Management System", "provider": "SWAYAM", "url": "https://onlinecourses.swayam2.ac.in/aic20_sp27/preview", "skills": ["Moodle", "LMS", "E-Learning", "Education Technology"], "duration": "15 weeks", "level": "Intermediate", "language": "English", "institution": "IIT Bombay", "description": "Set up and manage a Moodle-based learning management system for educational institutions and corporate training."},
    {"title": "Mother Health and Nutrition", "provider": "SWAYAM", "url": "https://onlinecourses.swayam2.ac.in/aic22_ge02/preview", "skills": ["Healthcare", "Nutrition", "Maternal Health", "Public Health"], "duration": "Self-paced", "level": "Beginner", "language": "English", "institution": "ICMR - National Institute of Nutrition", "description": "Maternal nutrition, prenatal care, breastfeeding, infant nutrition, and public health strategies for mother and child welfare."},
    {"title": "Ethics Review of Health Research", "provider": "SWAYAM", "url": "https://onlinecourses.swayam2.ac.in/aic22_ge22/preview", "skills": ["Health Research", "Ethics", "Clinical Trials", "Public Health", "Research Methods"], "duration": "Self-paced", "level": "Intermediate", "language": "English", "institution": "ICMR-National Institute of Epidemiology", "description": "Ethics review process for health research including IRB procedures, informed consent, risk assessment, and regulatory compliance."},
    {"title": "Scientific Writing in Health Research", "provider": "SWAYAM", "url": "https://onlinecourses.swayam2.ac.in/aic22_ge21/preview", "skills": ["Scientific Writing", "Research", "Healthcare", "Academic Writing"], "duration": "Self-paced", "level": "Intermediate", "language": "English", "institution": "ICMR-NIE", "description": "Scientific writing skills for health researchers covering research papers, abstracts, literature reviews, and journal publication."},
    {"title": "Introduction to Peace and Conflict Management", "provider": "SWAYAM", "url": "https://onlinecourses.swayam2.ac.in/nou24_hs01/preview", "skills": ["Conflict Management", "Peace Studies", "Negotiation", "Soft Skills"], "duration": "12 weeks", "level": "Beginner", "language": "English", "institution": "IGNOU", "description": "Introduction to peace studies, conflict resolution, negotiation, mediation, and peacebuilding in personal and professional settings."},
    {"title": "Economic Viability of Indian Agriculture", "provider": "SWAYAM", "url": "https://onlinecourses.swayam2.ac.in/aic21_ge22/preview", "skills": ["Agriculture", "Economics", "Farming", "Rural Development", "Agribusiness"], "duration": "6 weeks", "level": "Intermediate", "language": "English", "institution": "Maharshi Dayanand University", "description": "Analysis of Indian agricultural economics, crop viability, farming income, government policies, MSP, and rural development strategies."},
    {"title": "Primer on New Criminal Laws (NCL)", "provider": "SWAYAM", "url": "https://onlinecourses.swayam2.ac.in/cec25_lw03/preview", "skills": ["Law", "Criminal Law", "Legal", "Indian Law", "BNS"], "duration": "Self-paced", "level": "Beginner", "language": "Hindi", "institution": "National Law University", "description": "Overview of new Indian criminal laws — Bharatiya Nyaya Sanhita, Bharatiya Nagarik Suraksha Sanhita, and Bharatiya Sakshya Adhiniyam."},
    {"title": "Vector-Borne Diseases for Health Professionals", "provider": "SWAYAM", "url": "https://onlinecourses.swayam2.ac.in/aic24_ge39/preview", "skills": ["Healthcare", "Epidemiology", "Public Health", "Disease Prevention"], "duration": "8 weeks", "level": "Intermediate", "language": "English", "institution": "ICMR-NIE & ICMR-VCRC", "description": "Study of vector-borne diseases (malaria, dengue, chikungunya), transmission, prevention, vector control, and public health response."},
    {"title": "FrontAccounting - Business Accounting System", "provider": "SWAYAM", "url": "https://onlinecourses.swayam2.ac.in/aic20_sp60/preview", "skills": ["Accounting", "Finance", "Bookkeeping", "ERP", "Business"], "duration": "4 weeks", "level": "Beginner", "language": "English", "institution": "IIT Bombay", "description": "Learn FrontAccounting open-source ERP for business accounting, invoicing, inventory management, and financial reporting."},
    {"title": "Adolescent Nutrition", "provider": "SWAYAM", "url": "https://onlinecourses.swayam2.ac.in/aic22_ge11/preview", "skills": ["Nutrition", "Healthcare", "Adolescent Health", "Public Health"], "duration": "Self-paced", "level": "Beginner", "language": "English", "institution": "ICMR", "description": "Nutritional requirements of adolescents, common deficiencies, dietary guidelines, and public health interventions for adolescent nutrition."},

    # ─── Skill India Digital Hub (links to portal — individual course URLs are behind SPA) ───
    {"title": "Skill India — Digital Skills Courses", "provider": "SkillIndia", "url": "https://www.skillindiadigital.gov.in/courses", "skills": ["Digital Skills", "Computer Basics", "MS Office", "Internet", "Digital Literacy"], "duration": "Self-paced", "level": "Beginner", "language": "Hindi", "institution": "Ministry of Skill Development", "description": "Government portal offering free digital skills courses including computer basics, internet, MS Office, and digital safety. Browse courses at skillindiadigital.gov.in."},
    {"title": "Skill India — Entrepreneurship & Business", "provider": "SkillIndia", "url": "https://www.skillindiadigital.gov.in/courses", "skills": ["Entrepreneurship", "Business", "Startup", "Self-Employment", "MSME"], "duration": "Self-paced", "level": "Beginner", "language": "Hindi", "institution": "Ministry of Skill Development", "description": "Free government courses on entrepreneurship, business planning, MSME registration, MUDRA loans, and self-employment schemes."},
    {"title": "Skill India — Healthcare & Wellness", "provider": "SkillIndia", "url": "https://www.skillindiadigital.gov.in/courses", "skills": ["Healthcare", "Nursing", "Patient Care", "First Aid", "Wellness"], "duration": "Self-paced", "level": "Beginner", "language": "Hindi", "institution": "Ministry of Skill Development", "description": "Free government courses on healthcare, nursing assistance, patient care, first aid, and wellness through Skill India Digital Hub."},
    {"title": "Skill India — Agriculture & Allied", "provider": "SkillIndia", "url": "https://www.skillindiadigital.gov.in/courses", "skills": ["Agriculture", "Organic Farming", "Dairy", "Poultry", "Horticulture"], "duration": "Self-paced", "level": "Beginner", "language": "Hindi", "institution": "Ministry of Skill Development", "description": "Free government courses on modern farming, organic agriculture, dairy management, poultry, and horticulture techniques."},
    {"title": "Skill India — Beauty & Wellness", "provider": "SkillIndia", "url": "https://www.skillindiadigital.gov.in/courses", "skills": ["Beauty", "Wellness", "Cosmetology", "Hair Styling", "Personal Grooming"], "duration": "Self-paced", "level": "Beginner", "language": "Hindi", "institution": "Ministry of Skill Development", "description": "Free government courses on beauty therapy, hair styling, skin care, nail art, and salon management through Skill India."},
    {"title": "Skill India — Construction & Electrical", "provider": "SkillIndia", "url": "https://www.skillindiadigital.gov.in/courses", "skills": ["Construction", "Electrical", "Plumbing", "Welding", "Civil Engineering"], "duration": "Self-paced", "level": "Beginner", "language": "Hindi", "institution": "Ministry of Skill Development", "description": "Free government courses on construction, electrical wiring, plumbing, welding, and building maintenance through Skill India."},
    {"title": "Skill India — Hospitality & Tourism", "provider": "SkillIndia", "url": "https://www.skillindiadigital.gov.in/courses", "skills": ["Hotel Management", "Tourism", "Hospitality", "Food Service", "Customer Service"], "duration": "Self-paced", "level": "Beginner", "language": "Hindi", "institution": "Ministry of Skill Development", "description": "Free government courses on hotel management, food service, tourism, front office, and hospitality communication."},
]


# ─── MongoDB ─────────────────────────────────────────────────────────

def get_mongo_collection():
    uri = os.getenv("MONGODB_URI") or os.getenv("MONGO_URI")
    if not uri:
        raise RuntimeError("MONGODB_URI not set in .env")
    client = MongoClient(uri)
    # Use explicit DB name since connection string may not have a default
    db_name = os.getenv("MONGO_DB_NAME", "test")
    try:
        db = client.get_default_database()
    except Exception:
        db = client[db_name]
    return db["courses"]


# ─── Main Pipeline ───────────────────────────────────────────────────

def run(
    skip_scrape: bool = False,
    nptel_only: bool = False,
    swayam_only: bool = False,
    max_nptel: int = 80,
    max_swayam: int = 80,
    fetch_details: bool = True,
):
    start_time = time.time()
    logger.info("=" * 60)
    logger.info("Course Catalog Refresh — %s", datetime.now().strftime("%Y-%m-%d %H:%M"))
    logger.info("=" * 60)

    all_courses: list[dict] = []
    seen_titles: set[str] = set()

    def add_courses(courses: list[dict], source: str):
        added = 0
        for c in courses:
            title = c.get("title", "").strip()
            if title and title not in seen_titles:
                seen_titles.add(title)
                all_courses.append(c)
                added += 1
        logger.info("[%s] Added %d unique courses (skipped %d duplicates)", source, added, len(courses) - added)

    # 1. Scraped sources
    if not skip_scrape:
        if not swayam_only:
            logger.info("\n--- NPTEL Scraper ---")
            nptel_courses = scrape_nptel(max_courses=max_nptel, fetch_details=fetch_details)
            add_courses(nptel_courses, "NPTEL")

        if not nptel_only:
            logger.info("\n--- SWAYAM Scraper ---")
            swayam_courses = scrape_swayam(max_courses=max_swayam)
            add_courses(swayam_courses, "SWAYAM")

    # 2. Curated sources (always included)
    logger.info("\n--- Curated Catalog (Skill India + eSkill India) ---")
    for c in CURATED_COURSES:
        c["skillsText"] = f"{c['title']} {' '.join(c['skills'])} {c['description']}"
    add_courses(CURATED_COURSES, "Curated")

    logger.info("\nTotal unique courses: %d", len(all_courses))

    # 3. Generate embeddings
    has_gemini = init_gemini()
    if has_gemini:
        logger.info("\nGenerating embeddings for %d courses...", len(all_courses))
        for i, course in enumerate(all_courses):
            text = course.get("skillsText", course.get("title", ""))
            embedding = generate_embedding(text)
            course["skillsEmbedding"] = embedding
            if (i + 1) % 10 == 0:
                logger.info("  Embeddings: %d/%d", i + 1, len(all_courses))
                time.sleep(1)  # Rate limit — 1s every 10 requests
        logger.info("  Embeddings complete")
    else:
        logger.warning("Skipping embeddings (no Gemini API key)")

    # 4. Write to MongoDB
    logger.info("\nWriting to MongoDB...")
    collection = get_mongo_collection()

    # Clear and rewrite (atomic-ish for a seed)
    collection.delete_many({})

    # Prepare documents
    docs = []
    for c in all_courses:
        doc = {
            "title": c.get("title", ""),
            "provider": c.get("provider", ""),
            "url": c.get("url", ""),
            "skills": c.get("skills", []),
            "skillsText": c.get("skillsText", ""),
            "duration": c.get("duration", "Self-paced"),
            "level": c.get("level", "Beginner"),
            "language": c.get("language", "English"),
            "isFree": c.get("isFree", True),
            "institution": c.get("institution", ""),
            "description": c.get("description", ""),
            "active": True,
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow(),
        }
        if c.get("skillsEmbedding"):
            doc["skillsEmbedding"] = c["skillsEmbedding"]
        docs.append(doc)

    if docs:
        collection.insert_many(docs)

    elapsed = time.time() - start_time
    logger.info("\n" + "=" * 60)
    logger.info("DONE — %d courses written to MongoDB in %.1fs", len(docs), elapsed)
    logger.info("  NPTEL:      %d", sum(1 for d in docs if d["provider"] == "NPTEL"))
    logger.info("  SWAYAM:     %d", sum(1 for d in docs if d["provider"] == "SWAYAM"))
    logger.info("  SkillIndia: %d", sum(1 for d in docs if d["provider"] == "SkillIndia"))
    logger.info("  eSkillIndia:%d", sum(1 for d in docs if d["provider"] == "eSkillIndia"))
    logger.info("=" * 60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Refresh course catalog")
    parser.add_argument("--skip-scrape", action="store_true", help="Skip scrapers, use curated only")
    parser.add_argument("--nptel-only", action="store_true", help="Only scrape NPTEL + curated")
    parser.add_argument("--swayam-only", action="store_true", help="Only scrape SWAYAM + curated")
    parser.add_argument("--max-nptel", type=int, default=80, help="Max NPTEL courses")
    parser.add_argument("--max-swayam", type=int, default=80, help="Max SWAYAM courses")
    parser.add_argument("--no-details", action="store_true", help="Skip fetching NPTEL detail pages (faster)")
    args = parser.parse_args()

    run(
        skip_scrape=args.skip_scrape,
        nptel_only=args.nptel_only,
        swayam_only=args.swayam_only,
        max_nptel=args.max_nptel,
        max_swayam=args.max_swayam,
        fetch_details=not args.no_details,
    )
