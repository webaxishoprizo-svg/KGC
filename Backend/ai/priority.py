"""
KGC Lite — Priority Scoring
Standalone module for priority score calculation and ranking.
Called after every vote and complaint merge.
"""

from database.models import Issue


def calculate_priority_score(
    complaint_count:  int,
    votes_urgent:     int,
    votes_important:  int,
    votes_minor:      int,
) -> float:
    """
    Priority Score Formula:
      score = (complaints  × 2.0)
            + (urgent      × 3.0)
            + (important   × 1.5)
            + (minor       × 0.5)

    Weights rationale:
      - Each complaint proves real citizens affected (weight 2)
      - Urgent vote = critical issue needing fast action (weight 3)
      - Important vote = significant but not emergency (weight 1.5)
      - Minor vote = citizen engaged but not critical (weight 0.5)
    """
    score = (
        (complaint_count * 2.0) +
        (votes_urgent    * 3.0) +
        (votes_important * 1.5) +
        (votes_minor     * 0.5)
    )
    return round(score, 2)


def score_from_issue(issue: Issue) -> float:
    """Calculate priority score directly from an Issue ORM object."""
    return calculate_priority_score(
        complaint_count = issue.complaint_count  or 0,
        votes_urgent    = issue.votes_urgent     or 0,
        votes_important = issue.votes_important  or 0,
        votes_minor     = issue.votes_minor      or 0,
    )


def get_urgency_label(score: float) -> str:
    """Human-readable urgency label based on priority score."""
    if score >= 100:
        return "CRITICAL"
    elif score >= 50:
        return "HIGH"
    elif score >= 20:
        return "MEDIUM"
    else:
        return "LOW"


def get_priority_color(score: float) -> str:
    """CSS color class for priority badge in frontend."""
    if score >= 100:
        return "red"
    elif score >= 50:
        return "orange"
    elif score >= 20:
        return "yellow"
    else:
        return "green"
