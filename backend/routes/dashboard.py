from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import date

from models import Candidate, MatchResult, JobDescription, Interview
from auth import get_current_user
from utils.dependencies import get_db

router = APIRouter()

STATUS_KEY_MAP = {
    "new": "new",
    "reviewed": "reviewed",
    "interview scheduled": "interview_scheduled",
    "on hold": "on_hold",
    "rejected": "rejected",
    "hired": "hired",
    "archived": "archived",
    # legacy values from old data
    "shortlisted": "reviewed",
    "rejected by manager": "rejected",
    "rejected by org": "rejected",
    "position closed": "archived",
}


@router.get("/dashboard/stats")
def get_dashboard_stats(
    position_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    all_candidates = {c.id: c for c in db.query(Candidate).all()}
    all_matches = db.query(MatchResult).all()
    all_jds = {jd.id: jd for jd in db.query(JobDescription).all()}
    all_interviews = db.query(Interview).all()

    # Latest match per candidate overall (for score distribution)
    latest_match_by_candidate = {}
    for match in all_matches:
        cid = match.candidate_id
        if cid not in latest_match_by_candidate or match.id > latest_match_by_candidate[cid].id:
            latest_match_by_candidate[cid] = match
    latest_matches = list(latest_match_by_candidate.values())

    # Latest match per (candidate, jd) pair — used for positions overview + position filter
    latest_match_by_cand_jd = {}
    for match in all_matches:
        key = (match.candidate_id, match.jd_id)
        if key not in latest_match_by_cand_jd or match.id > latest_match_by_cand_jd[key].id:
            latest_match_by_cand_jd[key] = match

    # Pipeline matches and total_candidates — filtered by position_id when set
    if position_id:
        # Deduplicate by candidate_id — one entry per candidate for this position
        seen_for_pos: dict = {}
        for m in latest_match_by_cand_jd.values():
            if m.jd_id == position_id:
                if m.candidate_id not in seen_for_pos or m.id > seen_for_pos[m.candidate_id].id:
                    seen_for_pos[m.candidate_id] = m
        pipeline_matches = list(seen_for_pos.values())
        total_candidates_count = len(pipeline_matches)
    else:
        pipeline_matches = latest_matches
        total_candidates_count = len(all_candidates)

    # Pipeline counts
    pipeline = {"new": 0, "reviewed": 0, "interview_scheduled": 0, "on_hold": 0, "rejected": 0, "hired": 0, "archived": 0}
    for match in pipeline_matches:
        key = STATUS_KEY_MAP.get((match.status or "New").lower().strip(), "new")
        pipeline[key] += 1

    # Score distribution — filtered by pipeline_matches when position_id is set
    score_matches = pipeline_matches if position_id else latest_matches
    score_dist = {"0_40": 0, "41_70": 0, "71_100": 0}
    score_sum = 0
    score_count = 0
    for match in score_matches:
        if match.overall_score is not None:
            score_sum += match.overall_score
            score_count += 1
            if match.overall_score >= 71:
                score_dist["71_100"] += 1
            elif match.overall_score >= 41:
                score_dist["41_70"] += 1
            else:
                score_dist["0_40"] += 1
    avg_score = round(score_sum / score_count) if score_count > 0 else 0

    # Active / on-hold position counts — filtered to selected JD when position_id is set
    jds_for_status = (
        [all_jds[position_id]] if (position_id and position_id in all_jds)
        else list(all_jds.values())
    )
    active_positions = sum(
        1 for jd in jds_for_status
        if (jd.status or "").lower() in ("open", "in_progress")
    )
    on_hold_positions = sum(
        1 for jd in jds_for_status
        if (jd.status or "").lower() == "on_hold"
    )

    # Positions overview — latest match per candidate per JD only
    matches_by_jd_latest = {}
    for match in latest_match_by_cand_jd.values():
        matches_by_jd_latest.setdefault(match.jd_id, []).append(match)

    positions_data = []
    jds_for_table = (
        [all_jds[position_id]] if (position_id and position_id in all_jds)
        else list(all_jds.values())
    )
    for jd in jds_for_table:
        jd_matches = matches_by_jd_latest.get(jd.id, [])
        scores = [m.overall_score for m in jd_matches if m.overall_score is not None]
        avg_jd_score = round(sum(scores) / len(scores)) if scores else 0
        shortlisted = sum(1 for m in jd_matches if (m.status or "").lower() == "interview scheduled")
        hired = sum(1 for m in jd_matches if (m.status or "").lower() == "hired")
        positions_data.append({
            "id": jd.id,
            "title": jd.title,
            "total_applicants": len(set(m.candidate_id for m in jd_matches)),
            "avg_score": avg_jd_score,
            "shortlisted": shortlisted,
            "hired": hired,
            "status": jd.status or "open",
        })
    positions_data.sort(key=lambda p: p["total_applicants"], reverse=True)

    # Interview counts and upcoming (no hard cap — frontend scrolls)
    active_scheduled_count = sum(
        1 for i in all_interviews
        if i.status in ("scheduled", "rescheduled")
        and i.interview_date >= date.today()
        and (position_id is None or i.position_id == position_id)
    )
    interview_stats = {
        "total": active_scheduled_count,
        "scheduled": active_scheduled_count,
        "completed": sum(1 for i in all_interviews if i.status == "completed"),
        "cancelled": sum(1 for i in all_interviews if i.status == "cancelled"),
    }

    upcoming_raw = sorted(
        [i for i in all_interviews
         if i.status in ("scheduled", "rescheduled")
         and i.interview_date >= date.today()
         and (position_id is None or i.position_id == position_id)],
        key=lambda i: (i.interview_date, str(i.interview_time)),
    )

    interview_stats["upcoming"] = [
        {
            "id": i.id,
            "candidate_name": all_candidates[i.candidate_id].name if i.candidate_id in all_candidates else "Unknown",
            "position": all_jds[i.position_id].title if i.position_id and i.position_id in all_jds else "N/A",
            "interview_date": i.interview_date,
            "interview_time": str(i.interview_time),
            "google_meet_link": i.google_meet_link,
            "interview_type": i.interview_type,
        }
        for i in upcoming_raw
    ]

    return {
        "overview": {
            "total_candidates": total_candidates_count,
            "active_positions": active_positions,
            "on_hold_positions": on_hold_positions,
            "total_interviews": active_scheduled_count,
            "avg_match_score": avg_score,
        },
        "pipeline": pipeline,
        "positions": positions_data,
        "interviews": interview_stats,
        "score_analytics": {
            "avg_score": avg_score,
            "score_distribution": score_dist,
        },
    }
