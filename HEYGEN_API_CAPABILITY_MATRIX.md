# HeyGen API Capability Matrix

This document provides a comprehensive audit of current HeyGen API capabilities (V2/V3 REST API specifications) for the **PointBlank AI Video Generator** healthcare SaaS platform.

---

## Capability & Endpoint Overview

| Feature Area | Supported? | Endpoint | Method | Auth Header | Required Parameters | Sync / Async Workflow | Account Restrictions / Notes | Official Ref |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Public / Studio Avatars** | **YES** | `/v2/avatars` | `GET` | `X-Api-Key` | None | Synchronous | Returns list of studio avatars (`avatar_id`, `name`, `gender`, `preview_image_url`, `preview_video_url`). | HeyGen V2 Avatars API |
| **Photo Avatars / Talking Photos** | **YES** | `/v3/avatars` or `/v2/avatars` | `GET`, `POST` | `X-Api-Key` | `type: "photo"`, `file: {type: "url", url: "..."}` | Asynchronous | Uploads image via URL, returns `avatar_item.id` / `talking_photo_id`. Status check via `/v3/avatars/looks/{id}`. | HeyGen V3 Avatars API |
| **Instant Avatars / Digital Twins** | **NO (Self-Serve REST)** | N/A | N/A | N/A | N/A | Enterprise manual setup | Requires custom video recording upload & HeyGen manual training/enterprise plan. | HeyGen Instant Avatar Docs |
| **Public Voice Library** | **YES** | `/v2/voices` | `GET` | `X-Api-Key` | None | Synchronous | Returns available public voices (`voice_id`, `name`, `language`, `gender`, `preview_audio`). | HeyGen V2 Voices API |
| **Custom Voice Cloning** | **UNSUPPORTED (Standard Account)** | `/v2/voices/clone` | `POST` | `X-Api-Key` | Audio sample, consent recording | Asynchronous | Requires Enterprise tier with Voice Cloning permissions. UI displays fallback notice. | HeyGen Custom Voice Docs |
| **Video Generation (Studio Avatar)** | **YES** | `/v2/video/generate` | `POST` | `X-Api-Key` | `video_inputs[0].character.type: "avatar"`, `avatar_id`, `voice_id`, `input_text` | Asynchronous | Returns `{ data: { video_id: "..." } }`. Rate limit: depends on plan credits. | HeyGen V2 Video Generate API |
| **Video Generation (Photo Avatar)** | **YES** | `/v2/video/generate` | `POST` | `X-Api-Key` | `video_inputs[0].character.type: "talking_photo"`, `talking_photo_id`, `voice_id`, `input_text` | Asynchronous | Returns `{ data: { video_id: "..." } }`. | HeyGen V2 Video Generate API |
| **Video Status Tracking** | **YES** | `/v1/video_status.get` or `/v2/video/status` | `GET` | `X-Api-Key` | `video_id` query param | Polling / Webhook | Returns status (`pending`, `processing`, `completed`, `failed`), `video_url`, `thumbnail_url`. | HeyGen Status API |
| **Video Templates** | **YES** | `/v2/templates` | `GET` | `X-Api-Key` | None | Synchronous | Returns studio templates list. | HeyGen V2 Templates API |
| **Webhooks** | **YES** | `/v2/webhooks/endpoints` | `POST`/`GET` | `X-Api-Key` | `url`, `events: ["avatar_video.success", "avatar_video.fail"]` | Asynchronous Push | Optional server callback for job updates. | HeyGen Webhooks API |
| **Aspect Ratios & Resolutions** | **YES** | `/v2/video/generate` | `POST` | `X-Api-Key` | `dimension: { width: 1920, height: 1080 }` | Asynchronous | 16:9 (1920x1080), 9:16 (1080x1920), 1:1 (1080x1080). | HeyGen V2 Video Generate API |
| **Captions** | **YES** | `/v2/video/generate` | `POST` | `X-Api-Key` | `caption: true/false` | Asynchronous | Embedded dynamic subtitles in rendered video. | HeyGen V2 Video Generate API |

---

## Detailed Endpoint Specifications

### 1. Avatars Retrieval (`GET /v2/avatars`)
* **Request:** `GET https://api.heygen.com/v2/avatars`
* **Headers:** `X-Api-Key: <SECRET_KEY>`
* **Response Schema:**
```json
{
  "error": null,
  "data": {
    "avatars": [
      {
        "avatar_id": "Angela-inblacksuit-20220820",
        "avatar_name": "Angela",
        "gender": "female",
        "preview_image_url": "https://...",
        "preview_video_url": "https://..."
      }
    ],
    "talking_photos": [
      {
        "talking_photo_id": "tp_123456",
        "talking_photo_name": "Doctor Photo",
        "preview_image_url": "https://..."
      }
    ]
  }
}
```

### 2. Voices Retrieval (`GET /v2/voices`)
* **Request:** `GET https://api.heygen.com/v2/voices`
* **Headers:** `X-Api-Key: <SECRET_KEY>`
* **Response Schema:**
```json
{
  "error": null,
  "data": {
    "voices": [
      {
        "voice_id": "1bd001e7e50f421d96d99806477e505a",
        "name": "en-US-JennyNeural",
        "language": "English",
        "gender": "female",
        "preview_audio": "https://..."
      }
    ]
  }
}
```

### 3. Video Generation (`POST /v2/video/generate`)
* **Request:** `POST https://api.heygen.com/v2/video/generate`
* **Headers:** `X-Api-Key: <SECRET_KEY>`, `Content-Type: application/json`
* **Payload (Studio Avatar):**
```json
{
  "title": "Doctor PointBlank Video",
  "caption": false,
  "dimension": {
    "width": 1920,
    "height": 1080
  },
  "video_inputs": [
    {
      "character": {
        "type": "avatar",
        "avatar_id": "Angela-inblacksuit-20220820",
        "avatar_style": "normal"
      },
      "voice": {
        "type": "text",
        "input_text": "Welcome to our clinic. Today we discuss heart health.",
        "voice_id": "1bd001e7e50f421d96d99806477e505a",
        "speed": 1.0
      },
      "background": {
        "type": "color",
        "value": "#FAFAFA"
      }
    }
  ]
}
```
* **Payload (Talking Photo):**
```json
{
  "title": "Doctor PointBlank Video",
  "caption": false,
  "dimension": {
    "width": 1920,
    "height": 1080
  },
  "video_inputs": [
    {
      "character": {
        "type": "talking_photo",
        "talking_photo_id": "tp_123456"
      },
      "voice": {
        "type": "text",
        "input_text": "Welcome to our clinic. Today we discuss heart health.",
        "voice_id": "1bd001e7e50f421d96d99806477e505a"
      }
    }
  ]
}
```
* **Response Schema:**
```json
{
  "error": null,
  "data": {
    "video_id": "v_abcdef123456"
  }
}
```

### 4. Video Status Check (`GET /v1/video_status.get`)
* **Request:** `GET https://api.heygen.com/v1/video_status.get?video_id=v_abcdef123456`
* **Headers:** `X-Api-Key: <SECRET_KEY>`
* **Response Schema:**
```json
{
  "error": null,
  "data": {
    "id": "v_abcdef123456",
    "status": "completed",
    "video_url": "https://files2.heygen.ai/video/v_abcdef123456/file.mp4?Expires=...",
    "thumbnail_url": "https://files2.heygen.ai/video/v_abcdef123456/image.jpg?Expires=...",
    "duration": 18.5,
    "error": null
  }
}
```

---

## Account & Operational Constraints

1. **Unsupported Features to Omit/Notice in UI:**
   - **Custom Voice Cloning:** Display standard message: *"Custom voice creation is not available for this HeyGen API/account configuration."*
   - **Instant Digital Twin Creation (automated):** Display standard message: *"Instant Digital Twin creation requires enterprise account configuration."*

2. **Temporary URL Expiration:**
   - HeyGen returned video URLs expire within 24-48 hours.
   - PointBlank **MUST** download the completed video file to permanent local/cloud storage (Supabase Storage / local persistent disk) and serve playback/downloads via PointBlank URLs.

3. **Separation of Identifiers:**
   - PointBlank IDs: `PB-DOC-000001`, `PB-VID-xxxx`, `PB-PUB-token`
   - HeyGen IDs: `avatar_id`, `talking_photo_id`, `voice_id`, `video_id`
   - **NEVER** use HeyGen IDs in place of PointBlank internal IDs or vice versa.
