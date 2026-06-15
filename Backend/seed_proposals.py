import asyncio
import logging
from sqlalchemy import select
from database.connection import async_engine, AsyncSessionLocal, Base
from database.models import User, Issue, Proposal, CategoryEnum, IssueStatusEnum
import uuid

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DEMO_ISSUES = [
  {
    "title": "Broken Cauvery Water Pipeline in Main Road",
    "description": "Major water pipeline burst causing flooding and no water supply for 3 days in Ward 12.",
    "category": CategoryEnum.WATER,
    "district": "Mangaluru",
    "location": "Main Road, Ward 12",
    "department": "Water Board",
    "complaint_count": 52,
    "priority_score": 12.5,
    "votes_urgent": 140,
    "votes_important": 20,
    "votes_minor": 5,
    "total_votes": 165,
    "status": IssueStatusEnum.APPROVED
  },
  {
    "title": "Deep Potholes on Highway causing Accidents",
    "description": "Multiple severe accidents reported due to deep potholes on the state highway near the junction.",
    "category": CategoryEnum.ROADS,
    "district": "Belagavi",
    "location": "NH-44 Junction",
    "department": "Highways Dept",
    "complaint_count": 89,
    "priority_score": 15.8,
    "votes_urgent": 210,
    "votes_important": 10,
    "votes_minor": 2,
    "total_votes": 222,
    "status": IssueStatusEnum.APPROVED
  },
  {
    "title": "Frequent Power Cuts during School Hours",
    "description": "Daily power cuts from 10 AM to 2 PM disrupting online classes and school activities.",
    "category": CategoryEnum.ELECTRICITY,
    "district": "Hubballi",
    "location": "Anna Nagar",
    "department": "TNEB",
    "complaint_count": 34,
    "priority_score": 8.2,
    "votes_urgent": 85,
    "votes_important": 40,
    "votes_minor": 15,
    "total_votes": 140,
    "status": IssueStatusEnum.APPROVED
  },
  {
    "title": "Primary Health Center lacks Medicines",
    "description": "The local PHC has been out of essential medicines including paracetamol for a week.",
    "category": CategoryEnum.UNKNOWN, # mapped to health usually but we only have standard categories
    "district": "Mysuru",
    "location": "Gandhipuram PHC",
    "department": "Health Dept",
    "complaint_count": 15,
    "priority_score": 9.5,
    "votes_urgent": 60,
    "votes_important": 45,
    "votes_minor": 5,
    "total_votes": 110,
    "status": IssueStatusEnum.APPROVED
  },
  {
    "title": "Stray Dog Menace in Residential Area",
    "description": "Pack of stray dogs attacking pedestrians, especially children, in the evenings.",
    "category": CategoryEnum.UNKNOWN,
    "district": "Bengaluru",
    "location": "Velachery",
    "department": "Corporation",
    "complaint_count": 28,
    "priority_score": 4.1,
    "votes_urgent": 25,
    "votes_important": 55,
    "votes_minor": 30,
    "total_votes": 110,
    "status": IssueStatusEnum.APPROVED
  }
]

MOCK_PROPOSALS = [
  {
    "content": "We should mandate rainwater harvesting in all new commercial buildings across Bengaluru. With summer droughts getting worse, this is non-negotiable for future water security.",
    "tags": ["#WaterSecurity", "#Bengaluru"],
    "upvotes": 1240,
    "downvotes": 45,
    "comments": 128,
  },
  {
    "content": "Introduce free breakfast schemes in all government-aided schools, not just fully government ones. Many students in aided schools also come from economically weaker sections.",
    "tags": ["#Education", "#Equality"],
    "upvotes": 3402,
    "downvotes": 12,
    "comments": 450,
  },
  {
    "content": "Digital grievance tracking is great, but we need physical 'E-Sevai' kiosks in every village panchayat for citizens who don't have smartphones to log their issues easily.",
    "tags": ["#DigitalIndia", "#Accessibility"],
    "upvotes": 890,
    "downvotes": 67,
    "comments": 92,
  },
  {
    "content": "Subsidize solar water pumps for delta region farmers. The current electricity grid is too unreliable during peak summer sowing seasons.",
    "tags": ["#Agriculture", "#FarmersFirst"],
    "upvotes": 2150,
    "downvotes": 88,
    "comments": 210,
  },
  {
    "content": "Implement dedicated bus lanes on OMR during peak hours. Traffic is costing thousands of hours of productivity every single day.",
    "tags": ["#Traffic", "#OMR", "#Bengaluru"],
    "upvotes": 5600,
    "downvotes": 340,
    "comments": 890,
  }
]

async def seed_data():
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    async with AsyncSessionLocal() as db:
        # Get or create a dummy user
        user = await db.scalar(select(User).limit(1))
        if not user:
            user = User(mobile="9999999999", name="System Demo User")
            db.add(user)
            await db.commit()
            await db.refresh(user)

        # 1. Seed Issues
        logger.info("Seeding demo issues...")
        for issue_data in DEMO_ISSUES:
            # check if exists
            exists = await db.scalar(select(Issue).where(Issue.title == issue_data["title"]))
            if not exists:
                new_issue = Issue(**issue_data)
                db.add(new_issue)
                
        # 2. Seed Proposals
        logger.info("Seeding demo proposals...")
        for prop_data in MOCK_PROPOSALS:
            exists = await db.scalar(select(Proposal).where(Proposal.content == prop_data["content"]))
            if not exists:
                new_prop = Proposal(
                    user_id=user.id,
                    content=prop_data["content"],
                    tags=prop_data["tags"],
                    upvotes=prop_data["upvotes"],
                    downvotes=prop_data["downvotes"],
                    comments=prop_data["comments"]
                )
                db.add(new_prop)
                
        await db.commit()
        logger.info("Demo data seeding complete.")

if __name__ == "__main__":
    asyncio.run(seed_data())
