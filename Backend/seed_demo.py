import asyncio
from database.connection import AsyncSessionLocal
from database.models import User, Issue, IssueStatusEnum, CategoryEnum
from sqlalchemy import select
from datetime import datetime, timezone

async def seed():
    print("Seeding demo issues into the local database...")
    async with AsyncSessionLocal() as db:
        # Get admin user
        result = await db.execute(select(User).where(User.mobile == "9999999999"))
        admin = result.scalar_one_or_none()
        
        if not admin:
            print("Admin user not found. Please run migrate.py first.")
            return

        demo_issues = [
            {
                "title":           "Water Supply Failure — Ward 12, Mangaluru",
                "description":     "Residents of Ward 12 have been without piped water for 3 days. 47 complaints received from Srinivasa Nagar, Kondapalli Street, and surrounding areas. Elderly residents and families with children are severely affected.",
                "category":        CategoryEnum.WATER,
                "department":      "Karnataka Water Supply Board",
                "location":        "Ward 12, Mangaluru",
                "complaint_count": 47,
                "status":          IssueStatusEnum.APPROVED,
                "votes_urgent":    89,
                "votes_important": 34,
                "votes_minor":     5,
            },
            {
                "title":           "Street Lights Out — Anna Nagar, Bengaluru",
                "description":     "Multiple street lights on 3rd Avenue and 5th Cross Street have been non-functional for 2 weeks. Citizens report safety concerns, especially for women walking at night. 23 complaints filed.",
                "category":        CategoryEnum.ELECTRICITY,
                "department":      "Karnataka Electricity Board",
                "location":        "Anna Nagar, Bengaluru",
                "complaint_count": 23,
                "status":          IssueStatusEnum.APPROVED,
                "votes_urgent":    45,
                "votes_important": 67,
                "votes_minor":     12,
            },
            {
                "title":           "Dangerous Pothole — Belagavi Main Road",
                "description":     "A large pothole (approx. 3ft wide, 1ft deep) on Belagavi-Namakkal main road near Petrol Bunk junction has caused 2 minor accidents in the past week. 31 complaints received.",
                "category":        CategoryEnum.ROADS,
                "department":      "Highways Department",
                "location":        "Belagavi-Namakkal Main Road, Belagavi",
                "complaint_count": 31,
                "status":          IssueStatusEnum.APPROVED,
                "votes_urgent":    71,
                "votes_important": 28,
                "votes_minor":     3,
            },
            {
                "title":           "Borewell Motor Failure — Hubballi East",
                "description":     "Community borewell motor in Gandhi Nagar has failed. 180 residents dependent on this borewell for drinking water. Issue reported for 5 days with no response.",
                "category":        CategoryEnum.WATER,
                "department":      "Karnataka Water Supply Board",
                "location":        "Gandhi Nagar, Hubballi East",
                "complaint_count": 18,
                "status":          IssueStatusEnum.PENDING,
                "votes_urgent":    0,
                "votes_important": 0,
                "votes_minor":     0,
            },
            {
                "title":           "Transformer Overload — Mysuru RS Puram",
                "description":     "Old transformer in RS Puram causing frequent power cuts (3-4 times daily). Residents facing voltage fluctuation damaging appliances. 15 complaints filed.",
                "category":        CategoryEnum.ELECTRICITY,
                "department":      "Karnataka Electricity Board",
                "location":        "RS Puram, Mysuru",
                "complaint_count": 15,
                "status":          IssueStatusEnum.APPROVED,
                "votes_urgent":    33,
                "votes_important": 41,
                "votes_minor":     8,
            },
        ]

        seeded_count = 0
        for data in demo_issues:
            # Check duplicate
            dup = await db.execute(select(Issue).where(Issue.title == data["title"]))
            if dup.scalar_one_or_none():
                print(f"Skipping duplicate: {data['title']}")
                continue

            votes_urgent = data.pop("votes_urgent")
            votes_important = data.pop("votes_important")
            votes_minor = data.pop("votes_minor")

            issue = Issue(**data)
            issue.votes_urgent = votes_urgent
            issue.votes_important = votes_important
            issue.votes_minor = votes_minor
            issue.total_votes = votes_urgent + votes_important + votes_minor
            issue.priority_score = (
                data["complaint_count"] * 2.0 +
                votes_urgent            * 3.0 +
                votes_important         * 1.5 +
                votes_minor             * 0.5
            )
            if data["status"] == IssueStatusEnum.APPROVED:
                issue.approved_by = admin.id
                issue.approved_at = datetime.now(timezone.utc)

            db.add(issue)
            seeded_count += 1
            print(f"Adding: {data['title']}")

        await db.commit()
        print(f"Successfully seeded {seeded_count} demo issues.")

if __name__ == "__main__":
    asyncio.run(seed())
