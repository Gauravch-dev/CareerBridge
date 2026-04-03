"""
NPTEL Course Scraper
Scrapes course catalog from nptel.ac.in (allowed by robots.txt)
Extracts: title, URL, department, instructor, institution, description, duration
"""

import requests
from bs4 import BeautifulSoup
import json
import time
import re
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [NPTEL] %(message)s")
logger = logging.getLogger(__name__)

BASE_URL = "https://nptel.ac.in"
COURSES_URL = f"{BASE_URL}/courses"

# Map NPTEL departments to skill tags
DEPT_SKILL_MAP = {
    "Computer Science": ["Computer Science", "Programming"],
    "Electrical Engineering": ["Electrical Engineering", "Electronics"],
    "Mechanical Engineering": ["Mechanical Engineering"],
    "Civil Engineering": ["Civil Engineering", "Construction"],
    "Chemical Engineering": ["Chemical Engineering"],
    "Aerospace Engineering": ["Aerospace Engineering"],
    "Mathematics": ["Mathematics", "Statistics"],
    "Physics": ["Physics"],
    "Chemistry": ["Chemistry"],
    "Management": ["Management", "Business"],
    "Humanities": ["Communication Skills", "Soft Skills"],
    "Biotechnology": ["Biotechnology", "Biology"],
    "Metallurgy": ["Metallurgy", "Materials Science"],
    "Mining": ["Mining Engineering"],
    "Textile": ["Textile Engineering"],
    "Ocean": ["Ocean Engineering"],
    "Architecture": ["Architecture", "Design"],
    "Environmental": ["Environmental Science", "Sustainability"],
}

HEADERS = {
    "User-Agent": "YuvaSetu-CourseBot/1.0 (Educational Platform; contact: team@yuvasetu.in)",
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-IN,en;q=0.9",
}


def extract_skills_from_text(title: str, department: str) -> list[str]:
    """Extract skill tags from course title and department."""
    skills = set()

    # Add department-based skills
    for dept_key, dept_skills in DEPT_SKILL_MAP.items():
        if dept_key.lower() in department.lower():
            skills.update(dept_skills)

    # Extract tech keywords from title
    tech_keywords = {
        "python": "Python", "java": "Java", "c++": "C++", "c programming": "C Programming",
        "machine learning": "Machine Learning", "deep learning": "Deep Learning",
        "artificial intelligence": "AI", "data science": "Data Science",
        "database": "Database", "sql": "SQL", "cloud": "Cloud Computing",
        "blockchain": "Blockchain", "iot": "IoT", "robotics": "Robotics",
        "cyber": "Cybersecurity", "network": "Networking",
        "web": "Web Development", "software": "Software Engineering",
        "algorithm": "Algorithms", "data structure": "Data Structures",
        "operating system": "Operating Systems", "compiler": "Compilers",
        "cryptography": "Cryptography", "nlp": "NLP",
        "natural language": "NLP", "computer vision": "Computer Vision",
        "image processing": "Image Processing", "signal processing": "Signal Processing",
        "control system": "Control Systems", "embedded": "Embedded Systems",
        "vlsi": "VLSI", "digital": "Digital Electronics",
        "power": "Power Systems", "communication": "Communication Skills",
        "management": "Management", "marketing": "Marketing",
        "finance": "Finance", "accounting": "Accounting",
        "economics": "Economics", "statistics": "Statistics",
        "probability": "Probability", "optimization": "Optimization",
        "linear algebra": "Linear Algebra", "calculus": "Calculus",
        "thermodynamics": "Thermodynamics", "fluid": "Fluid Mechanics",
        "structural": "Structural Engineering", "geotechnical": "Geotechnical Engineering",
        "transportation": "Transportation Engineering",
        "water": "Water Resources", "environmental": "Environmental Engineering",
        "manufacturing": "Manufacturing", "cad": "CAD",
        "design": "Design", "material": "Materials Science",
    }

    title_lower = title.lower()
    for keyword, skill in tech_keywords.items():
        if keyword in title_lower:
            skills.add(skill)

    # Always add the title itself as a skill context
    if len(skills) == 0:
        # Use first 2-3 meaningful words from title
        words = [w for w in title.split() if len(w) > 3 and w.lower() not in {"introduction", "advanced", "basic", "fundamentals", "principles"}]
        skills.update(words[:3])

    return list(skills)


def scrape_course_list() -> list[dict]:
    """Scrape the main NPTEL course listing page."""
    logger.info("Fetching course catalog from %s", COURSES_URL)

    try:
        resp = requests.get(COURSES_URL, headers=HEADERS, timeout=30)
        resp.raise_for_status()
    except requests.RequestException as e:
        logger.error("Failed to fetch course list: %s", e)
        return []

    soup = BeautifulSoup(resp.text, "html.parser")

    courses = []
    current_dept = "General"

    # NPTEL lists courses grouped by department
    # Each course is typically in an <a> tag linking to /courses/XXXX
    for link in soup.find_all("a", href=True):
        href = link.get("href", "")
        if not re.match(r"^/courses/\d+", href):
            continue

        # Extract text content
        text_parts = [t.strip() for t in link.stripped_strings]
        if len(text_parts) < 2:
            continue

        title = text_parts[0]
        department = text_parts[1] if len(text_parts) > 1 else current_dept
        instructor = text_parts[2] if len(text_parts) > 2 else ""
        institution = text_parts[3] if len(text_parts) > 3 else "IIT"

        # Clean up instructor
        instructor = instructor.replace("Prof.", "").replace("Dr.", "").strip()
        if instructor.startswith(","):
            instructor = instructor[1:].strip()

        course_url = f"{BASE_URL}{href}"
        skills = extract_skills_from_text(title, department)

        courses.append({
            "title": title,
            "provider": "NPTEL",
            "url": course_url,
            "skills": skills,
            "department": department,
            "instructor": instructor,
            "institution": institution if institution else "IIT",
            "duration": "12 weeks",  # default, updated from detail page
            "level": "Intermediate",
            "language": "English",
            "isFree": True,
        })

    logger.info("Found %d courses from catalog page", len(courses))
    return courses


def scrape_course_detail(course: dict) -> dict:
    """Fetch additional details from individual course page."""
    try:
        resp = requests.get(course["url"], headers=HEADERS, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        # Try to extract description from meta or page content
        meta_desc = soup.find("meta", attrs={"name": "description"})
        if meta_desc and meta_desc.get("content"):
            course["description"] = meta_desc["content"].strip()

        # Look for syllabus/about section
        if not course.get("description"):
            for heading in soup.find_all(["h2", "h3", "h4"]):
                if any(kw in heading.get_text().lower() for kw in ["about", "syllabus", "overview", "description"]):
                    sibling = heading.find_next_sibling()
                    if sibling:
                        course["description"] = sibling.get_text(strip=True)[:500]
                        break

        # Extract week count from content
        page_text = soup.get_text()
        week_match = re.search(r"(\d+)\s*weeks?", page_text, re.IGNORECASE)
        if week_match:
            weeks = int(week_match.group(1))
            course["duration"] = f"{weeks} weeks"

        # Determine level from keywords
        text_lower = page_text.lower()
        if any(kw in text_lower for kw in ["advanced", "graduate", "postgraduate"]):
            course["level"] = "Advanced"
        elif any(kw in text_lower for kw in ["introduct", "beginner", "basic", "fundamental"]):
            course["level"] = "Beginner"

    except Exception as e:
        logger.warning("Failed to fetch detail for %s: %s", course["title"], e)

    # Ensure description exists
    if not course.get("description"):
        course["description"] = f"NPTEL course on {course['title']} by {course.get('institution', 'IIT')}. Department: {course.get('department', 'N/A')}."

    return course


def scrape_nptel(max_courses: int = 100, fetch_details: bool = True) -> list[dict]:
    """
    Main entry point: scrape NPTEL courses.

    Args:
        max_courses: Maximum courses to return
        fetch_details: If True, fetch individual course pages for descriptions (slower but better data)

    Returns:
        List of course dicts ready for MongoDB
    """
    courses = scrape_course_list()

    if not courses:
        logger.warning("No courses found from catalog. Using fallback.")
        return []

    # DIVERSITY SAMPLING: Don't just take first N (which are all Aerospace).
    # Instead, sample evenly across departments to get diverse courses.
    from collections import defaultdict
    import random
    random.seed(42)  # Reproducible

    by_dept: dict[str, list[dict]] = defaultdict(list)
    for c in courses:
        by_dept[c.get("department", "Other")].append(c)

    sampled: list[dict] = []
    depts = sorted(by_dept.keys())
    per_dept = max(1, max_courses // max(len(depts), 1))

    for dept in depts:
        dept_courses = by_dept[dept]
        random.shuffle(dept_courses)
        sampled.extend(dept_courses[:per_dept])

    # If we still need more, fill from remaining
    if len(sampled) < max_courses:
        used_urls = {c["url"] for c in sampled}
        remaining = [c for c in courses if c["url"] not in used_urls]
        random.shuffle(remaining)
        sampled.extend(remaining[: max_courses - len(sampled)])

    courses = sampled[:max_courses]
    logger.info("Sampled %d courses across %d departments", len(courses), len(depts))

    if fetch_details:
        logger.info("Fetching details for %d courses (this may take a while)...", len(courses))
        for i, course in enumerate(courses):
            scrape_course_detail(course)
            if (i + 1) % 10 == 0:
                logger.info("  Progress: %d/%d", i + 1, len(courses))
            time.sleep(0.5)  # Be polite — 500ms between requests

    # Build skillsText for embedding
    for course in courses:
        course["skillsText"] = f"{course['title']} {' '.join(course['skills'])} {course.get('description', '')}"
        course.pop("department", None)  # Clean up non-schema fields

    logger.info("NPTEL scraping complete: %d courses", len(courses))
    return courses


if __name__ == "__main__":
    results = scrape_nptel(max_courses=50, fetch_details=True)
    print(json.dumps(results[:3], indent=2, ensure_ascii=False))
    print(f"\nTotal: {len(results)} courses scraped")
