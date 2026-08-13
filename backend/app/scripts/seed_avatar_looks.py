import logging
from app.database import SessionLocal, engine, Base
from app.models import AvatarLook, get_next_pb_id

logger = logging.getLogger("seed_avatar_looks")

DEFAULT_LOOKS = [
    {
        "look_id": "PB-LOOK-000001",
        "name": "Professional Doctor",
        "description": "Clean professional doctor appearance with white clinical coat, stethoscope accent, soft studio lighting, and medium portrait framing.",
        "preview_image_url": "/uploads/look_previews/professional_doctor.jpg",
        "clothing_style": "White Doctor Lab Coat with Professional Attire",
        "background_type": "clinical_studio",
        "background_value": "linear-gradient(135deg, #E6F3F7 0%, #D0EAEE 100%)",
        "lighting_style": "Soft Clinical Studio Portrait Lighting",
        "camera_framing": "medium",
        "body_position": "standing",
        "subject_position": "center",
        "scale": "1.0",
        "crop_style": "chest_up",
        "aspect_ratio": "16:9",
        "transformation_prompt": "A highly professional front-facing portrait of a doctor wearing a clean white lab coat in a modern medical studio setting. Preserve facial identity, skin tone, facial features, and structure completely.",
        "negative_prompt": "blurry, low quality, casual clothes, messy background, distorted face, extra limbs, cartoon, anime",
        "is_active": True
    },
    {
        "look_id": "PB-LOOK-000002",
        "name": "Clinic Professional",
        "description": "Healthcare clinic environment with ambient clinical backdrop, consultation setting, and warm professional appearance.",
        "preview_image_url": "/uploads/look_previews/clinic_professional.jpg",
        "clothing_style": "Smart Healthcare Scrub / Clinical Suit",
        "background_type": "clinic_room",
        "background_value": "linear-gradient(135deg, #E2F1F5 0%, #CBE4EC 100%)",
        "lighting_style": "Natural Ambient Clinical Lighting",
        "camera_framing": "medium",
        "body_position": "sitting",
        "subject_position": "center",
        "scale": "1.0",
        "crop_style": "waist_up",
        "aspect_ratio": "9:16",
        "transformation_prompt": "A warm professional portrait of a doctor inside a modern healthcare clinic room. Preserving exact face structure, recognizable features, and identity.",
        "negative_prompt": "dark, shadowy, casual attire, messy room, distorted eyes, bad anatomy",
        "is_active": True
    },
    {
        "look_id": "PB-LOOK-000003",
        "name": "Medical Office",
        "description": "Doctor office presentation with warm clinical background, executive desk environment, and authoritative medical stance.",
        "preview_image_url": "/uploads/look_previews/medical_office.jpg",
        "clothing_style": "Executive Medical Formal Blazer",
        "background_type": "office_desk",
        "background_value": "linear-gradient(135deg, #F1F5F9 0%, #E2E8F0 100%)",
        "lighting_style": "Warm Executive Office Lighting",
        "camera_framing": "medium",
        "body_position": "seated_desk",
        "subject_position": "center",
        "scale": "1.0",
        "crop_style": "medium_shot",
        "aspect_ratio": "16:9",
        "transformation_prompt": "An executive doctor portrait in a high-end medical office with subtle medical books and clinical certificates. Preserving facial identity and natural appearance.",
        "negative_prompt": "overexposed, grainy, cartoon, casual, cluttered",
        "is_active": True
    },
    {
        "look_id": "PB-LOOK-000004",
        "name": "Studio Professional",
        "description": "Clean high-definition healthcare studio backdrop with neutral professional lighting and sleek broadcast framing.",
        "preview_image_url": "/uploads/look_previews/studio_professional.jpg",
        "clothing_style": "Dark Navy Professional Medical Suit",
        "background_type": "broadcast_studio",
        "background_value": "linear-gradient(135deg, #1E293B 0%, #0F172A 100%)",
        "lighting_style": "High-Definition Broadcast Studio Lighting",
        "camera_framing": "close_up",
        "body_position": "standing",
        "subject_position": "center",
        "scale": "1.0",
        "crop_style": "close_up",
        "aspect_ratio": "16:9",
        "transformation_prompt": "A crisp studio presentation portrait of a doctor with neutral dark medical backdrop and professional broadcast lighting. Facial identity preserved.",
        "negative_prompt": "noisy, oversaturated, altered face, cartoonish, low resolution",
        "is_active": True
    },
    {
        "look_id": "PB-LOOK-000005",
        "name": "Formal Doctor",
        "description": "Professional formal doctor presentation style with dark suit blazer, crisp shirt, and refined healthcare presentation aesthetics.",
        "preview_image_url": "/uploads/look_previews/formal_doctor.jpg",
        "clothing_style": "Formal Business Healthcare Attire",
        "background_type": "formal_gradient",
        "background_value": "linear-gradient(135deg, #0F2B38 0%, #051A24 100%)",
        "lighting_style": "Refined Key Portrait Lighting",
        "camera_framing": "medium",
        "body_position": "standing",
        "subject_position": "center",
        "scale": "1.0",
        "crop_style": "medium_shot",
        "aspect_ratio": "16:9",
        "transformation_prompt": "A formal healthcare keynote doctor portrait in formal medical presentation attire. Facial features, structure, and identity strictly preserved.",
        "negative_prompt": "unprofessional, casual shirt, distorted, unrealistic",
        "is_active": True
    }
]

def seed_avatar_looks():
    """
    Idempotent database seeder for PointBlank Look presets (PB-LOOK-000001 through PB-LOOK-000005).
    Safely checks existing records to prevent duplicate creation.
    """
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        logger.warning(f"Base.metadata.create_all warning: {e}")

    db = SessionLocal()

    try:
        inserted_count = 0
        for look_data in DEFAULT_LOOKS:
            existing = db.query(AvatarLook).filter(AvatarLook.look_id == look_data["look_id"]).first()
            if not existing:
                look_obj = AvatarLook(**look_data)
                db.add(look_obj)
                inserted_count += 1
                logger.info(f"Seeded Avatar Look: {look_data['look_id']} - {look_data['name']}")
            else:
                logger.info(f"Avatar Look already exists: {look_data['look_id']} - {look_data['name']}")

        db.commit()
        print(f"Look seeding complete! New records inserted: {inserted_count}, Total default looks: {len(DEFAULT_LOOKS)}")
    except Exception as e:
        db.rollback()
        logger.error(f"Error seeding avatar looks: {e}")
        print(f"Error seeding avatar looks: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    seed_avatar_looks()
