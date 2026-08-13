from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import User, DoctorProfile, get_next_pb_id
from app.schemas import DoctorCreateRequest, DoctorResponse
from app.dependencies.auth import get_current_user

router = APIRouter(prefix="/api/v1/doctors", tags=["Doctors"])

@router.post("", response_model=DoctorResponse, status_code=status.HTTP_201_CREATED)
def create_doctor(
    doc_req: DoctorCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    pb_doc_id = get_next_pb_id(db, 'pb_doctor_id_seq', 'PB-DOC')

    new_doc = DoctorProfile(
        doctor_id=pb_doc_id,
        user_id=current_user.id, # Server-scoped ownership
        doctor_name=doc_req.doctor_name.strip(),
        specialization=doc_req.specialization.strip(),
        avatar_type=doc_req.avatar_type,
        heygen_avatar_id=doc_req.heygen_avatar_id,
        heygen_talking_photo_id=doc_req.heygen_talking_photo_id,
        heygen_voice_id=doc_req.heygen_voice_id
    )

    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)

    res = DoctorResponse.model_validate(new_doc)
    res.video_count = 0
    return res

@router.get("", response_model=List[DoctorResponse])
def list_doctors(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == "ADMIN":
        doctors = db.query(DoctorProfile).order_by(DoctorProfile.created_at.desc()).all()
    else:
        doctors = db.query(DoctorProfile).filter(DoctorProfile.user_id == current_user.id).order_by(DoctorProfile.created_at.desc()).all()

    res_list = []
    for doc in doctors:
        d_res = DoctorResponse.model_validate(doc)
        d_res.video_count = len(doc.videos)
        res_list.append(d_res)

    return res_list

@router.get("/{id}", response_model=DoctorResponse)
def get_doctor(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    doc = db.query(DoctorProfile).filter(DoctorProfile.id == id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Doctor profile not found.")

    if current_user.role != "ADMIN" and doc.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied to this doctor profile.")

    d_res = DoctorResponse.model_validate(doc)
    d_res.video_count = len(doc.videos)
    return d_res
