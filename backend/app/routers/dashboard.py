from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, DoctorProfile, Video, AvatarScenario, Voice
from app.schemas import DashboardSummaryResponse, VideoResponse
from app.dependencies.auth import get_current_user

router = APIRouter(prefix="/api/v1/dashboard", tags=["Dashboard"])

@router.get("/summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Server-enforced scoping
    if current_user.role == "ADMIN":
        doctor_count = db.query(DoctorProfile).count()
        scenario_count = db.query(AvatarScenario).filter(AvatarScenario.is_deleted == False).count()
        voice_count = db.query(Voice).filter(Voice.is_deleted == False).count()
        video_query = db.query(Video).filter(Video.is_deleted == False)
    else:
        doctor_count = db.query(DoctorProfile).filter(DoctorProfile.user_id == current_user.id).count()
        scenario_count = db.query(AvatarScenario).filter(AvatarScenario.user_id == current_user.id, AvatarScenario.is_deleted == False).count()
        voice_count = db.query(Voice).filter(Voice.user_id == current_user.id, Voice.is_deleted == False).count()
        video_query = db.query(Video).filter(Video.user_id == current_user.id, Video.is_deleted == False)

    total_videos = video_query.count()
    processing_videos = video_query.filter(Video.status.in_(["PENDING", "PROCESSING"])).count()
    completed_videos = video_query.filter(Video.status == "COMPLETED").count()

    recent_videos_models = video_query.order_by(Video.created_at.desc()).limit(10).all()

    recent_videos_res = []
    for vid in recent_videos_models:
        v_dict = VideoResponse.model_validate(vid).model_dump()
        if vid.doctor:
            v_dict["doctor_name"] = vid.doctor.doctor_name
        if vid.avatar_scenario:
            v_dict["scenario_name"] = vid.avatar_scenario.name
        if vid.saved_voice:
            v_dict["voice_name"] = vid.saved_voice.name
        recent_videos_res.append(VideoResponse(**v_dict))

    return DashboardSummaryResponse(
        total_doctors=doctor_count,
        total_scenarios=scenario_count,
        total_voices=voice_count,
        total_videos=total_videos,
        processing_videos=processing_videos,
        completed_videos=completed_videos,
        recent_videos=recent_videos_res
    )
