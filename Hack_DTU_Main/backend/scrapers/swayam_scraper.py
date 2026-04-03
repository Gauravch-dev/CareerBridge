"""
SWAYAM Course Scraper
Scrapes course catalog from swayam.gov.in
SWAYAM is a SPA that embeds course data in the initial HTML payload.
We extract the embedded JSON from the page source.
"""

import requests
from bs4 import BeautifulSoup
import json
import re
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [SWAYAM] %(message)s")
logger = logging.getLogger(__name__)

EXPLORER_URL = "https://swayam.gov.in/explorer"

HEADERS = {
    "User-Agent": "YuvaSetu-CourseBot/1.0 (Educational Platform; contact: team@yuvasetu.in)",
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-IN,en;q=0.9",
}

# Skill extraction from SWAYAM category names
CATEGORY_SKILL_MAP = {
    "Computer Science": ["Computer Science", "Programming"],
    "Engineering": ["Engineering"],
    "Management": ["Management", "Business"],
    "Humanities": ["Humanities", "Communication Skills"],
    "Science": ["Science"],
    "Mathematics": ["Mathematics"],
    "Economics": ["Economics", "Finance"],
    "Commerce": ["Commerce", "Accounting"],
    "Education": ["Education", "Teaching"],
    "Law": ["Law", "Legal"],
    "Library": ["Library Science"],
    "Social": ["Social Science"],
    "Agriculture": ["Agriculture", "Farming"],
    "Architecture": ["Architecture", "Design"],
    "Arts": ["Arts", "Creative"],
    "Health": ["Healthcare", "Public Health"],
    "Multidisciplinary": ["General"],
}

# Search terms to cover diverse sectors
SEARCH_TERMS = [
    "python", "machine learning", "data science", "web development",
    "communication skills", "soft skills", "management",
    "finance", "accounting", "banking",
    "marketing", "human resource",
    "law", "contract",
    "agriculture", "farming",
    "health", "nursing", "pharmacy",
    "design", "graphic",
    "economics", "statistics",
    "entrepreneurship", "startup",
    "environmental", "sustainability",
    "mechanical", "civil engineering",
    "electrical", "electronics",
    "cyber security", "networking",
    "android", "mobile development",
    "cloud computing", "devops",
    "artificial intelligence",
    "business analytics",
    "supply chain", "logistics",
    "teaching", "education",
    "writing", "english",
]


def extract_skills_from_title(title: str, categories: list) -> list[str]:
    """Extract skill tags from course title and categories."""
    skills = set()

    # From categories
    for cat in categories:
        cat_name = cat.get("name", "") if isinstance(cat, dict) else str(cat)
        for key, cat_skills in CATEGORY_SKILL_MAP.items():
            if key.lower() in cat_name.lower():
                skills.update(cat_skills)

    # Keyword extraction from title
    keywords = {
        "python": "Python", "java": "Java", "javascript": "JavaScript",
        "machine learning": "Machine Learning", "deep learning": "Deep Learning",
        "artificial intelligence": "AI", "data science": "Data Science",
        "data analytics": "Data Analytics", "database": "Database",
        "web development": "Web Development", "cloud": "Cloud Computing",
        "blockchain": "Blockchain", "iot": "IoT", "robotics": "Robotics",
        "cyber": "Cybersecurity", "network": "Networking",
        "software": "Software Engineering", "algorithm": "Algorithms",
        "communication": "Communication Skills", "soft skill": "Soft Skills",
        "management": "Management", "marketing": "Marketing",
        "finance": "Finance", "accounting": "Accounting",
        "economics": "Economics", "statistics": "Statistics",
        "law": "Law", "legal": "Legal",
        "health": "Healthcare", "nursing": "Nursing",
        "pharmacy": "Pharmacy", "agriculture": "Agriculture",
        "design": "Design", "graphic": "Graphic Design",
        "excel": "Excel", "leadership": "Leadership",
        "project management": "Project Management",
        "business": "Business", "entrepreneurship": "Entrepreneurship",
        "environmental": "Environmental Science",
        "mechanical": "Mechanical Engineering",
        "civil": "Civil Engineering",
        "electrical": "Electrical Engineering",
        "writing": "Writing Skills", "english": "English",
        "hindi": "Hindi", "teaching": "Teaching",
    }

    title_lower = title.lower()
    for kw, skill in keywords.items():
        if kw in title_lower:
            skills.add(skill)

    if not skills:
        words = [w for w in title.split() if len(w) > 3]
        skills.update(words[:3])

    return list(skills)


def determine_level(title: str, weeks: int) -> str:
    """Determine course level from title and duration."""
    title_lower = title.lower()
    if any(kw in title_lower for kw in ["advanced", "graduate", "post"]):
        return "Advanced"
    elif any(kw in title_lower for kw in ["introduct", "beginner", "basic", "fundamental"]):
        return "Beginner"
    elif weeks and weeks > 12:
        return "Advanced"
    return "Intermediate"


def extract_courses_from_html(html: str) -> list[dict]:
    """Extract course data embedded in SWAYAM HTML page."""
    courses = []

    # SWAYAM embeds course data in script tags as JSON
    # Look for course objects in the page source
    soup = BeautifulSoup(html, "html.parser")

    # Method 1: Find JSON in script tags
    for script in soup.find_all("script"):
        text = script.string or ""
        # Look for course data patterns
        if "edges" in text and "node" in text and "title" in text:
            try:
                # Extract the JSON object containing course edges
                json_match = re.search(r'"edges"\s*:\s*\[(.*?)\]\s*,\s*"pageInfo"', text, re.DOTALL)
                if json_match:
                    edges_str = "[" + json_match.group(1) + "]"
                    edges = json.loads(edges_str)
                    for edge in edges:
                        node = edge.get("node", edge)
                        if node.get("title"):
                            courses.append(node)
            except (json.JSONDecodeError, AttributeError):
                pass

    # Method 2: Find individual course objects
    if not courses:
        course_pattern = re.finditer(
            r'\{"id"\s*:\s*"[^"]+"\s*,\s*"title"\s*:\s*"([^"]+)".*?"url"\s*:\s*"([^"]+)".*?\}',
            html, re.DOTALL,
        )
        for match in course_pattern:
            try:
                # Try to parse the full match as JSON
                start = match.start()
                # Find the closing brace
                depth = 0
                end = start
                for i in range(start, min(start + 2000, len(html))):
                    if html[i] == "{":
                        depth += 1
                    elif html[i] == "}":
                        depth -= 1
                        if depth == 0:
                            end = i + 1
                            break
                obj_str = html[start:end]
                obj = json.loads(obj_str)
                if obj.get("title"):
                    courses.append(obj)
            except (json.JSONDecodeError, ValueError):
                pass

    return courses


def scrape_swayam_search(search_term: str) -> list[dict]:
    """Scrape SWAYAM search results for a given term."""
    url = f"{EXPLORER_URL}?searchText={requests.utils.quote(search_term)}"

    try:
        resp = requests.get(url, headers=HEADERS, timeout=20)
        resp.raise_for_status()
    except requests.RequestException as e:
        logger.warning("Failed to fetch search results for '%s': %s", search_term, e)
        return []

    raw_courses = extract_courses_from_html(resp.text)
    return raw_courses


def normalize_course(raw: dict) -> dict:
    """Normalize a raw SWAYAM course object to our schema."""
    title = raw.get("title", "").strip()
    url = raw.get("url", "")
    categories = raw.get("category", [])
    weeks = raw.get("weeks", 0)
    if isinstance(weeks, str):
        try:
            weeks = int(weeks)
        except ValueError:
            weeks = 0
    if weeks == -1:
        weeks = 0

    institution = raw.get("instructorInstitute", "")
    language = raw.get("courseLanguage", "English")
    instructor = raw.get("explorerInstructorName", "")

    skills = extract_skills_from_title(title, categories if isinstance(categories, list) else [])
    level = determine_level(title, weeks)

    summary = raw.get("explorerSummary", "")
    if not summary:
        summary = f"SWAYAM course: {title}."
        if institution:
            summary += f" Offered by {institution}."

    # Clean HTML from summary
    if "<" in summary:
        summary = BeautifulSoup(summary, "html.parser").get_text(strip=True)
    summary = summary[:500]

    duration = f"{weeks} weeks" if weeks > 0 else "Self-paced"

    return {
        "title": title,
        "provider": "SWAYAM",
        "url": url if url.startswith("http") else f"https://swayam.gov.in{url}",
        "skills": skills,
        "skillsText": f"{title} {' '.join(skills)} {summary}",
        "duration": duration,
        "level": level,
        "language": language,
        "isFree": True,
        "institution": institution,
        "instructor": instructor,
        "description": summary,
    }


def scrape_swayam(max_courses: int = 100) -> list[dict]:
    """
    Main entry point: scrape SWAYAM courses across diverse search terms.

    Args:
        max_courses: Maximum total courses to return

    Returns:
        List of course dicts ready for MongoDB
    """
    seen_titles = set()
    all_courses = []

    # Search for diverse topics FIRST (higher priority than generic explorer)
    for term in SEARCH_TERMS:
        if len(all_courses) >= max_courses:
            break

        logger.info("Searching for '%s'...", term)
        raw_courses = scrape_swayam_search(term)

        added = 0
        for raw in raw_courses:
            if len(all_courses) >= max_courses:
                break
            title = raw.get("title", "").strip()
            if title and title not in seen_titles:
                seen_titles.add(title)
                all_courses.append(normalize_course(raw))
                added += 1

        if added > 0:
            logger.info("  Added %d new courses (total: %d)", added, len(all_courses))

    # Fill remaining from main explorer page
    if len(all_courses) < max_courses:
        logger.info("Fetching main explorer page for more...")
        try:
            resp = requests.get(EXPLORER_URL, headers=HEADERS, timeout=20)
            resp.raise_for_status()
            raw_courses = extract_courses_from_html(resp.text)
            added = 0
            for raw in raw_courses:
                if len(all_courses) >= max_courses:
                    break
                title = raw.get("title", "").strip()
                if title and title not in seen_titles:
                    seen_titles.add(title)
                    all_courses.append(normalize_course(raw))
                    added += 1
            if added > 0:
                logger.info("  Added %d from explorer (total: %d)", added, len(all_courses))
        except requests.RequestException as e:
            logger.warning("Explorer page failed: %s", e)

    logger.info("SWAYAM scraping complete: %d unique courses", len(all_courses))
    return all_courses[:max_courses]


if __name__ == "__main__":
    results = scrape_swayam(max_courses=50)
    print(json.dumps(results[:3], indent=2, ensure_ascii=False))
    print(f"\nTotal: {len(results)} courses scraped")
