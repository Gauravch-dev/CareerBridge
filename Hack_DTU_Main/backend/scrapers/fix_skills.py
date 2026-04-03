"""
Fix skill tags for all courses in MongoDB.
Extracts proper skills from title + description instead of relying on department labels.

Run: python scrapers/fix_skills.py
"""

import os
import re
import logging
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
logger = logging.getLogger(__name__)

# Comprehensive keyword → skill mapping
# Key = keyword to search for in title/description (lowercase)
# Value = skill tag to assign
SKILL_KEYWORDS = {
    # Programming Languages
    "python": "Python",
    "java ": "Java",      # space after to avoid matching "javascript"
    "java,": "Java",
    "java.": "Java",
    "programming in java": "Java",
    "javascript": "JavaScript",
    "typescript": "TypeScript",
    "c++": "C++",
    "c programming": "C Programming",
    " c ": "C Programming",
    "golang": "Go",
    "rust ": "Rust",
    "kotlin": "Kotlin",
    "swift": "Swift",
    "r programming": "R",
    "matlab": "MATLAB",
    "ruby": "Ruby",
    "php": "PHP",
    "scala": "Scala",
    "perl": "Perl",

    # Web Development
    "react": "React",
    "angular": "Angular",
    "vue": "Vue.js",
    "node.js": "Node.js",
    "nodejs": "Node.js",
    "express": "Express.js",
    "django": "Django",
    "flask": "Flask",
    "spring": "Spring",
    "html": "HTML",
    "css": "CSS",
    "web development": "Web Development",
    "web designing": "Web Development",
    "frontend": "Frontend",
    "full stack": "Full Stack",
    "fullstack": "Full Stack",
    "rest api": "REST API",
    "api": "API Development",

    # Mobile
    "android": "Android",
    "ios development": "iOS",
    "mobile development": "Mobile Development",
    "flutter": "Flutter",
    "react native": "React Native",

    # Data & AI
    "machine learning": "Machine Learning",
    "deep learning": "Deep Learning",
    "artificial intelligence": "AI",
    " ai ": "AI",
    "data science": "Data Science",
    "data analytics": "Data Analytics",
    "data analysis": "Data Analysis",
    "data mining": "Data Mining",
    "big data": "Big Data",
    "nlp": "NLP",
    "natural language": "NLP",
    "computer vision": "Computer Vision",
    "neural network": "Neural Networks",
    "tensorflow": "TensorFlow",
    "pytorch": "PyTorch",
    "pandas": "Pandas",
    "numpy": "NumPy",
    "reinforcement learning": "Reinforcement Learning",
    "generative ai": "Generative AI",

    # Databases
    "database": "Database",
    "sql": "SQL",
    "mysql": "MySQL",
    "postgresql": "PostgreSQL",
    "mongodb": "MongoDB",
    "nosql": "NoSQL",
    "oracle": "Oracle DB",
    "redis": "Redis",

    # Cloud & DevOps
    "cloud": "Cloud Computing",
    "aws": "AWS",
    "azure": "Azure",
    "google cloud": "GCP",
    "docker": "Docker",
    "kubernetes": "Kubernetes",
    "devops": "DevOps",
    "ci/cd": "CI/CD",
    "terraform": "Terraform",
    "microservice": "Microservices",

    # Security
    "cyber": "Cybersecurity",
    "security": "Security",
    "cryptography": "Cryptography",
    "ethical hacking": "Ethical Hacking",
    "penetration": "Penetration Testing",
    "encryption": "Encryption",

    # Networking
    "network": "Networking",
    "tcp": "TCP/IP",
    "internet protocol": "TCP/IP",
    "wireless": "Wireless Networks",

    # CS Fundamentals
    "algorithm": "Algorithms",
    "data structure": "Data Structures",
    "operating system": "Operating Systems",
    "compiler": "Compilers",
    "computer architecture": "Computer Architecture",
    "discrete math": "Discrete Mathematics",
    "automata": "Theory of Computation",
    "system design": "System Design",
    "software engineering": "Software Engineering",
    "software testing": "Software Testing",
    "agile": "Agile",
    "design pattern": "Design Patterns",
    "object oriented": "OOP",
    "oop": "OOP",
    "functional programming": "Functional Programming",

    # Electronics & Hardware
    "vlsi": "VLSI",
    "embedded": "Embedded Systems",
    "arduino": "Arduino",
    "raspberry": "Raspberry Pi",
    "iot": "IoT",
    "internet of things": "IoT",
    "fpga": "FPGA",
    "signal processing": "Signal Processing",
    "image processing": "Image Processing",
    "digital electronics": "Digital Electronics",
    "analog": "Analog Electronics",
    "microprocessor": "Microprocessors",
    "microcontroller": "Microcontrollers",
    "robotics": "Robotics",
    "sensor": "Sensors",

    # Electrical
    "power system": "Power Systems",
    "power electronics": "Power Electronics",
    "electric": "Electrical Engineering",
    "control system": "Control Systems",
    "circuit": "Circuit Analysis",

    # Mechanical
    "thermodynamic": "Thermodynamics",
    "fluid mechanic": "Fluid Mechanics",
    "heat transfer": "Heat Transfer",
    "manufacturing": "Manufacturing",
    "cad": "CAD",
    "mechanical": "Mechanical Engineering",
    "vibration": "Mechanical Vibrations",
    "automobile": "Automotive Engineering",
    "3d printing": "3D Printing",
    "additive manufacturing": "Additive Manufacturing",

    # Civil
    "structural": "Structural Engineering",
    "geotechnical": "Geotechnical Engineering",
    "construction": "Construction",
    "concrete": "Concrete Technology",
    "building": "Building Construction",
    "transportation": "Transportation Engineering",
    "water resource": "Water Resources",
    "surveying": "Surveying",
    "civil": "Civil Engineering",

    # Management & Business
    "management": "Management",
    "marketing": "Marketing",
    "finance": "Finance",
    "financial": "Finance",
    "accounting": "Accounting",
    "economics": "Economics",
    "entrepreneurship": "Entrepreneurship",
    "startup": "Startup",
    "supply chain": "Supply Chain",
    "logistics": "Logistics",
    "project management": "Project Management",
    "human resource": "HR Management",
    "hr ": "HR Management",
    "leadership": "Leadership",
    "business analytics": "Business Analytics",
    "operations research": "Operations Research",
    "strategic": "Strategic Management",
    "e-commerce": "E-Commerce",
    "banking": "Banking",
    "insurance": "Insurance",
    "stock market": "Stock Market",
    "investment": "Investment",
    "gst": "GST",
    "tax": "Taxation",
    "tally": "Tally",
    "bookkeeping": "Bookkeeping",

    # Communication & Soft Skills
    "communication": "Communication Skills",
    "soft skill": "Soft Skills",
    "english": "English",
    "spoken english": "Spoken English",
    "writing": "Writing Skills",
    "technical writing": "Technical Writing",
    "presentation": "Presentation Skills",
    "interview": "Interview Skills",
    "personality": "Personality Development",
    "public speaking": "Public Speaking",
    "negotiation": "Negotiation",
    "conflict": "Conflict Resolution",

    # Design
    "graphic design": "Graphic Design",
    "ui/ux": "UI/UX Design",
    "ui design": "UI Design",
    "ux design": "UX Design",
    "photoshop": "Photoshop",
    "illustrator": "Illustrator",
    "figma": "Figma",
    "animation": "Animation",
    "video editing": "Video Editing",
    "photography": "Photography",

    # Healthcare
    "health": "Healthcare",
    "nursing": "Nursing",
    "pharmacy": "Pharmacy",
    "biomedical": "Biomedical Engineering",
    "biotechnology": "Biotechnology",
    "genetics": "Genetics",
    "nutrition": "Nutrition",
    "epidemiology": "Epidemiology",
    "clinical": "Clinical Research",
    "medical": "Medical Sciences",
    "anatomy": "Anatomy",
    "public health": "Public Health",

    # Law
    "law": "Law",
    "legal": "Legal Studies",
    "contract": "Contract Law",
    "intellectual property": "Intellectual Property",
    "patent": "Patent Law",
    "copyright": "Copyright Law",
    "constitution": "Constitutional Law",
    "criminal law": "Criminal Law",

    # Agriculture
    "agriculture": "Agriculture",
    "farming": "Farming",
    "organic farming": "Organic Farming",
    "crop": "Crop Science",
    "soil": "Soil Science",
    "horticulture": "Horticulture",
    "dairy": "Dairy Science",
    "food processing": "Food Processing",
    "food technology": "Food Technology",
    "irrigation": "Irrigation",
    "fisheries": "Fisheries",
    "poultry": "Poultry",
    "veterinary": "Veterinary Science",

    # Science & Math
    "physics": "Physics",
    "chemistry": "Chemistry",
    "biology": "Biology",
    "mathematics": "Mathematics",
    "statistics": "Statistics",
    "probability": "Probability",
    "linear algebra": "Linear Algebra",
    "calculus": "Calculus",
    "differential equation": "Differential Equations",
    "numerical method": "Numerical Methods",
    "optimization": "Optimization",

    # Other
    "blockchain": "Blockchain",
    "cryptocurrency": "Cryptocurrency",
    "smart contract": "Smart Contracts",
    "excel": "Excel",
    "ms office": "MS Office",
    "digital marketing": "Digital Marketing",
    "seo": "SEO",
    "social media": "Social Media Marketing",
    "content marketing": "Content Marketing",
    "environmental": "Environmental Science",
    "sustainability": "Sustainability",
    "climate": "Climate Science",
    "energy": "Energy",
    "solar": "Solar Energy",
    "renewable": "Renewable Energy",
    "automobile": "Automotive",
    "aerospace": "Aerospace Engineering",
    "textile": "Textile Engineering",
    "mining": "Mining Engineering",
    "metallurgy": "Metallurgy",
    "material science": "Materials Science",
    "nanotechnology": "Nanotechnology",
    "semiconductor": "Semiconductors",
    "optical": "Optics",
    "quantum": "Quantum Computing",
    "geographic information": "GIS",
    "remote sensing": "Remote Sensing",
    "teaching": "Teaching",
    "education": "Education",
    "pedagogy": "Pedagogy",
    "research method": "Research Methods",
    "hotel management": "Hotel Management",
    "tourism": "Tourism",
    "hospitality": "Hospitality",
    "beauty": "Beauty & Wellness",
    "wellness": "Wellness",
    "yoga": "Yoga",
    "music": "Music",
    "psychology": "Psychology",
    "sociology": "Sociology",
    "philosophy": "Philosophy",
    "history": "History",
    "geography": "Geography",
    "political science": "Political Science",
}


def extract_skills(title: str, description: str) -> list[str]:
    """Extract skill tags from title and description using keyword matching."""
    text = f" {title} . {description} ".lower()
    skills = set()

    for keyword, skill in SKILL_KEYWORDS.items():
        if keyword in text:
            skills.add(skill)

    # Also add the title itself as context (clean it up)
    title_clean = re.sub(r"^(NOC:|noc:)\s*", "", title).strip()
    if title_clean and len(skills) == 0:
        # Fallback: use meaningful title words
        words = [w for w in title_clean.split() if len(w) > 3 and w.lower() not in
                 {"introduction", "advanced", "basic", "fundamentals", "principles", "elements", "overview", "selected", "topics"}]
        skills.update(words[:3])

    return sorted(skills)


def fix_all_courses():
    uri = os.getenv("MONGODB_URI") or os.getenv("MONGO_URI")
    if not uri:
        print("MONGODB_URI not set")
        return

    client = MongoClient(uri)
    try:
        db = client.get_default_database()
    except Exception:
        db = client["test"]

    collection = db["courses"]
    courses = list(collection.find({}))
    logger.info("Found %d courses to fix", len(courses))

    fixed = 0
    for course in courses:
        title = course.get("title", "")
        desc = course.get("description", "")
        old_skills = course.get("skills", [])

        new_skills = extract_skills(title, desc)

        if new_skills != old_skills:
            new_skills_text = f"{title} {' '.join(new_skills)} {desc}"
            collection.update_one(
                {"_id": course["_id"]},
                {"$set": {"skills": new_skills, "skillsText": new_skills_text}},
            )
            fixed += 1
            if fixed <= 10:
                logger.info("  %s", title)
                logger.info("    OLD: %s", ", ".join(old_skills))
                logger.info("    NEW: %s", ", ".join(new_skills))

    logger.info("\nFixed %d / %d courses", fixed, len(courses))

    # Show stats
    all_skills = {}
    for course in collection.find({}).limit(0):
        for s in course.get("skills", []):
            all_skills[s] = all_skills.get(s, 0) + 1
    updated = list(collection.find({}))
    all_skills = {}
    for c in updated:
        for s in c.get("skills", []):
            all_skills[s] = all_skills.get(s, 0) + 1
    top = sorted(all_skills.items(), key=lambda x: -x[1])[:30]
    logger.info("\nTop 30 skills after fix: %s", ", ".join(f"{s}:{c}" for s, c in top))
    logger.info("Total unique skills: %d", len(all_skills))

    client.close()


if __name__ == "__main__":
    fix_all_courses()
