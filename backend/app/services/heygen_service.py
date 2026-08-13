import logging
import httpx
from typing import Dict, Any, List, Optional
from app.config import settings

logger = logging.getLogger("heygen_service")

class HeyGenService:
    """
    Official HeyGen REST API Client Service for PointBlank AI Video Generator.
    Handles communication server-side. Never exposes API key to client.
    Strictly reports API errors; never returns mock data.
    """
    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None):
        self.api_key = api_key or settings.HEYGEN_API_KEY
        self.base_url = (base_url or settings.HEYGEN_BASE_URL).rstrip("/")

    def _get_headers(self, content_type: str = "application/json") -> Dict[str, str]:
        import os
        api_key = (settings.HEYGEN_API_KEY or os.getenv("HEYGEN_API_KEY", "") or self.api_key or "").strip("'\"")
        if not api_key:
            raise ValueError("HeyGen API Key is missing. Please configure HEYGEN_API_KEY in backend/.env")
        headers = {
            "Accept": "application/json",
            "X-Api-Key": api_key
        }
        if content_type:
            headers["Content-Type"] = content_type
        return headers

    async def get_avatars(self) -> Dict[str, Any]:
        """
        Retrieves real studio avatars and talking photos from HeyGen API v2.
        GET /v2/avatars
        """
        url = f"{self.base_url}/v2/avatars"
        headers = self._get_headers()

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, headers=headers)
            if response.status_code != 200:
                logger.error(f"HeyGen get_avatars failed with HTTP {response.status_code}: {response.text}")
                raise RuntimeError(f"HeyGen API Error ({response.status_code}): {response.text}")
            
            data = response.json()
            return data.get("data", {})

    async def get_avatars_v3(self) -> List[Dict[str, Any]]:
        """
        Retrieves Avatar IV / V3 avatars list via GET /v3/avatars.
        """
        url = f"{self.base_url}/v3/avatars"
        headers = self._get_headers()

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, headers=headers)
            if response.status_code != 200:
                logger.error(f"HeyGen get_avatars_v3 failed with HTTP {response.status_code}: {response.text}")
                raise RuntimeError(f"HeyGen V3 API Error ({response.status_code}): {response.text}")

            data = response.json()
            return data.get("data", [])

    async def get_voices(self) -> List[Dict[str, Any]]:
        """
        Retrieves public voices library from HeyGen API v2.
        GET /v2/voices
        """
        url = f"{self.base_url}/v2/voices"
        headers = self._get_headers()

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, headers=headers)
            if response.status_code != 200:
                logger.error(f"HeyGen get_voices failed with HTTP {response.status_code}: {response.text}")
                raise RuntimeError(f"HeyGen API Error ({response.status_code}): {response.text}")
            
            data = response.json()
            inner_data = data.get("data", {})
            if isinstance(inner_data, dict):
                return inner_data.get("voices", [])
            elif isinstance(inner_data, list):
                return inner_data
            return []

    async def list_avatar_looks(
        self,
        ownership: str = "public",
        avatar_type: Optional[str] = None,
        limit: int = 50,
        token: Optional[str] = None,
        group_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Lists real HeyGen Avatar Looks via GET /v3/avatars/looks.
        Supports HeyGen's documented cursor-based pagination (has_more/next_token).
        """
        url = f"{self.base_url}/v3/avatars/looks"
        headers = self._get_headers()

        params: Dict[str, Any] = {"ownership": ownership, "limit": max(1, min(limit, 50))}
        if avatar_type:
            params["avatar_type"] = avatar_type
        if group_id:
            params["group_id"] = group_id
        if token:
            params["token"] = token

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, headers=headers, params=params)
            if response.status_code != 200:
                logger.error(f"HeyGen list_avatar_looks failed with HTTP {response.status_code}: {response.text}")
                raise RuntimeError(f"HeyGen API Error ({response.status_code}): {response.text}")

            res_json = response.json()
            return {
                "data": res_json.get("data", []),
                "has_more": res_json.get("has_more", False),
                "next_token": res_json.get("next_token")
            }

    async def upload_asset_bytes(self, file_bytes: bytes, content_type: str = "image/jpeg") -> Dict[str, Any]:
        """
        Uploads raw image file bytes to HeyGen Asset service.
        POST https://upload.heygen.com/v1/asset
        Returns HeyGen Asset ID and CDN URL.
        """
        url = "https://upload.heygen.com/v1/asset"
        headers = self._get_headers(content_type=content_type)

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, headers=headers, content=file_bytes)
            if response.status_code not in (200, 201):
                logger.error(f"HeyGen asset upload failed with HTTP {response.status_code}: {response.text}")
                raise RuntimeError(f"HeyGen Asset Upload Failed ({response.status_code}): {response.text}")

            res_data = response.json()
            data = res_data.get("data", {})
            asset_id = data.get("id")
            asset_url = data.get("url")

            if not asset_id:
                raise RuntimeError(f"HeyGen Asset Upload response missing ID: {res_data}")

            return {
                "id": asset_id,
                "url": asset_url,
                "file_type": data.get("file_type", "image"),
                "raw_response": res_data
            }

    async def create_base_photo_avatar(self, photo_url: str, name: Optional[str] = None) -> Dict[str, Any]:
        """
        Step A: Creates a Base Photo Avatar on HeyGen via POST /v3/avatars.
        Returns data containing base avatar_item.id (Look ID) and group_id.
        """
        url = f"{self.base_url}/v3/avatars"
        headers = self._get_headers()

        payload = {
            "type": "photo",
            "name": name or "PointBlank Doctor Base Photo",
            "file": {
                "type": "url",
                "url": photo_url
            }
        }

        logger.info(f"Submitting HeyGen POST /v3/avatars (type=photo) for '{name}': photo_url={photo_url}")

        async with httpx.AsyncClient(timeout=45.0) as client:
            response = await client.post(url, headers=headers, json=payload)
            if response.status_code in (200, 201, 202):
                res_json = response.json()
                data = res_json.get("data", {})
                avatar_item = data.get("avatar_item", {})
                
                base_look_id = avatar_item.get("id") or data.get("id") or data.get("talking_photo_id")
                group_id = avatar_item.get("group_id") or data.get("group_id")
                preview_url = avatar_item.get("preview_image_url") or data.get("preview_image_url") or photo_url
                status = avatar_item.get("status") or data.get("status", "completed")

                if not base_look_id:
                    raise RuntimeError(f"HeyGen Base Photo Avatar response missing avatar_item.id: {res_json}")

                logger.info(f"Base Photo Avatar Created Successfully: base_look_id={base_look_id}, group_id={group_id}, status={status}")
                return {
                    "base_look_id": base_look_id,
                    "group_id": group_id,
                    "preview_image_url": preview_url,
                    "status": status,
                    "raw_response": res_json
                }

            if response.status_code == 402:
                err_text = response.text
                logger.error(f"HeyGen V3 avatar creation HTTP 402: {err_text}")
                raise RuntimeError("INSUFFICIENT_CREDITS: HeyGen API account has insufficient credits for Photo Avatar training. Please upgrade API credits on your HeyGen dashboard.")

            logger.error(f"HeyGen create_base_photo_avatar failed with HTTP {response.status_code}: {response.text}")
            raise RuntimeError(f"HeyGen Photo Avatar API Error ({response.status_code}): {response.text}")

    async def generate_avatar_look(
        self,
        base_look_id: str,
        prompt: str,
        name: Optional[str] = None,
        reference_images: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Step B: Generates a new professional Look from base photo avatar via POST /v3/avatars (type=prompt).
        Passes base_look_id as avatar_id. reference_images is optional (0 to 3 images max).
        """
        url = f"{self.base_url}/v3/avatars"
        headers = self._get_headers()

        payload: Dict[str, Any] = {
            "type": "prompt",
            "name": name or "Doctor Professional Look",
            "prompt": prompt,
            "avatar_id": base_look_id
        }

        if reference_images and len(reference_images) > 0:
            payload["reference_images"] = [
                {"type": "url", "url": ref_url} for ref_url in reference_images[:3]
            ]

        logger.info(f"Submitting HeyGen POST /v3/avatars (type=prompt): avatar_id={base_look_id}, prompt='{prompt[:60]}...'")

        async with httpx.AsyncClient(timeout=45.0) as client:
            response = await client.post(url, headers=headers, json=payload)
            if response.status_code in (200, 201, 202):
                res_json = response.json()
                data = res_json.get("data", {})
                avatar_item = data.get("avatar_item", {})

                generated_look_id = avatar_item.get("id") or data.get("id")
                group_id = avatar_item.get("group_id") or data.get("group_id")
                status = avatar_item.get("status") or data.get("status", "processing")
                preview_url = avatar_item.get("preview_image_url") or data.get("preview_image_url")

                if not generated_look_id:
                    raise RuntimeError(f"HeyGen Look Generation response missing generated avatar_item.id: {res_json}")

                logger.info(f"HeyGen Look Generation Submitted Successfully: generated_look_id={generated_look_id}, status={status}")
                return {
                    "generated_look_id": generated_look_id,
                    "group_id": group_id,
                    "status": status,
                    "preview_image_url": preview_url,
                    "raw_response": res_json
                }

            if response.status_code == 402:
                raise RuntimeError("INSUFFICIENT_CREDITS: HeyGen API account has insufficient credits for Look Generation.")

            logger.error(f"HeyGen generate_avatar_look failed with HTTP {response.status_code}: {response.text}")
            raise RuntimeError(f"HeyGen Look Generation API Error ({response.status_code}): {response.text}")

    async def get_avatar_look_status(self, look_id: str) -> Dict[str, Any]:
        """
        Step C: Polls status of a generated look via official endpoint:
        GET /v3/avatars/looks/{look_id}
        """
        url = f"{self.base_url}/v3/avatars/looks/{look_id}"
        headers = self._get_headers()

        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(url, headers=headers)
            
            # Fallback to GET /v3/avatars/{look_id} if specific /looks endpoint is 404
            if response.status_code == 404:
                fallback_url = f"{self.base_url}/v3/avatars/{look_id}"
                response = await client.get(fallback_url, headers=headers)

            if response.status_code != 200:
                logger.error(f"HeyGen get_avatar_look_status failed for {look_id} with HTTP {response.status_code}: {response.text}")
                raise RuntimeError(f"HeyGen Look Status Error ({response.status_code}): {response.text}")

            res_json = response.json()
            data = res_json.get("data", res_json)
            avatar_item = data.get("avatar_item", data)

            raw_status = str(avatar_item.get("status") or data.get("status", "processing")).lower()
            preview_url = avatar_item.get("preview_image_url") or data.get("preview_image_url")

            if raw_status in ("completed", "done", "ready", "success"):
                status = "completed"
            elif raw_status in ("failed", "error", "rejected"):
                status = "failed"
            else:
                status = "processing"

            error_obj = data.get("error") or avatar_item.get("error")
            error_message = None
            if isinstance(error_obj, dict):
                error_message = error_obj.get("message") or error_obj.get("code")
            elif error_obj:
                error_message = str(error_obj)

            return {
                "look_id": look_id,
                "status": status,
                "raw_status": raw_status,
                "preview_image_url": preview_url,
                "error": error_message
            }

    async def create_photo_avatar(self, photo_url: str, name: Optional[str] = None) -> Dict[str, Any]:
        """Backward compatible wrapper delegating to create_base_photo_avatar."""
        res = await self.create_base_photo_avatar(photo_url, name)
        return {
            "heygen_avatar_id": res["base_look_id"],
            "status": res["status"],
            "raw_response": res.get("raw_response")
        }


    async def generate_video(
        self,
        script: str,
        heygen_voice_id: str,
        avatar_type: str = "public",
        heygen_avatar_id: Optional[str] = None,
        heygen_talking_photo_id: Optional[str] = None,
        aspect_ratio: str = "16:9",
        captions: bool = False,
        background_color: str = "#FAFAFA",
        speed: float = 1.0
    ) -> str:
        """
        Submits real video generation request to HeyGen API v2.
        POST /v2/video/generate
        Returns HeyGen video_id.
        """
        url = f"{self.base_url}/v2/video/generate"
        headers = self._get_headers()

        dim_map = {
            "16:9": {"width": 1920, "height": 1080},
            "9:16": {"width": 1080, "height": 1920},
            "1:1": {"width": 1080, "height": 1080}
        }
        dimension = dim_map.get(aspect_ratio, {"width": 1920, "height": 1080})

        if avatar_type == "photo" or heygen_talking_photo_id:
            if not heygen_talking_photo_id and not heygen_avatar_id:
                raise ValueError("heygen_talking_photo_id or heygen_avatar_id is required for photo avatar type")
            target_id = heygen_talking_photo_id or heygen_avatar_id
            character = {
                "type": "talking_photo",
                "talking_photo_id": target_id
            }
        else:
            if not heygen_avatar_id:
                raise ValueError("heygen_avatar_id is required for studio avatar type")
            character = {
                "type": "avatar",
                "avatar_id": heygen_avatar_id,
                "avatar_style": "normal"
            }

        payload = {
            "title": "PointBlank Doctor AI Video",
            "caption": captions,
            "dimension": dimension,
            "video_inputs": [
                {
                    "character": character,
                    "voice": {
                        "type": "text",
                        "input_text": script,
                        "voice_id": heygen_voice_id,
                        "speed": speed
                    },
                    "background": {
                        "type": "color",
                        "value": background_color or "#FAFAFA"
                    }
                }
            ]
        }

        logger.info(f"Submitting HeyGen V2 Video Job: avatar_type={avatar_type}, avatar_id={heygen_avatar_id or heygen_talking_photo_id}, voice={heygen_voice_id}")

        async with httpx.AsyncClient(timeout=45.0) as client:
            response = await client.post(url, headers=headers, json=payload)
            
            if response.status_code == 402:
                logger.error("HeyGen API HTTP 402: Insufficient credits.")
                raise RuntimeError("INSUFFICIENT_CREDITS: HeyGen API account has insufficient credits to render video.")
            elif response.status_code == 404:
                logger.error(f"HeyGen API HTTP 404: Avatar look not found ({heygen_avatar_id or heygen_talking_photo_id}).")
                raise RuntimeError(f"AVATAR_NOT_FOUND: Avatar ID '{heygen_avatar_id or heygen_talking_photo_id}' is not recognized by HeyGen v2 API.")
            elif response.status_code not in (200, 201):
                logger.error(f"HeyGen generate_video HTTP {response.status_code} Error: {response.text}")
                raise RuntimeError(f"HeyGen Video Generation Failed ({response.status_code}): {response.text}")

            res_data = response.json()
            video_id = res_data.get("data", {}).get("video_id")
            if not video_id:
                raise RuntimeError(f"HeyGen API returned response without video_id: {res_data}")

            logger.info(f"HeyGen V2 Video Job Created Successfully! video_id={video_id}")
            return video_id

    async def generate_video_v3(
        self,
        script: str,
        heygen_voice_id: str,
        avatar_id: str,
        engine: str = "avatar_iv",
        aspect_ratio: str = "16:9"
    ) -> str:
        """
        Generates video using official HeyGen Avatar IV Engine via POST /v3/videos.
        Payload format per official HeyGen API v3 documentation:
        {
            "type": "avatar",
            "avatar_id": "<REAL_AVATAR_ID>",
            "script": "<SCRIPT>",
            "voice_id": "<VOICE_ID>",
            "engine": { "type": "avatar_iv" }
        }
        """
        url = f"{self.base_url}/v3/videos"
        headers = self._get_headers()

        payload: Dict[str, Any] = {
            "type": "avatar",
            "avatar_id": avatar_id,
            "script": script,
            "voice_id": heygen_voice_id,
            "engine": {
                "type": engine or "avatar_iv"
            }
        }

        logger.info(f"Submitting HeyGen V3 Avatar IV Video Job: avatar_id={avatar_id}, voice={heygen_voice_id}, engine={engine}")

        async with httpx.AsyncClient(timeout=45.0) as client:
            response = await client.post(url, headers=headers, json=payload)
            
            if response.status_code == 402:
                logger.error("HeyGen API V3 HTTP 402: Insufficient credits.")
                raise RuntimeError("INSUFFICIENT_CREDITS: HeyGen API account has insufficient credits to render video.")
            elif response.status_code == 404:
                logger.error(f"HeyGen API V3 HTTP 404: Avatar not found ({avatar_id}).")
                raise RuntimeError(f"AVATAR_NOT_FOUND: Avatar ID '{avatar_id}' is not recognized by HeyGen v3 API.")
            elif response.status_code not in (200, 201):
                logger.error(f"HeyGen V3 Avatar IV generate_video HTTP {response.status_code} Error: {response.text}")
                raise RuntimeError(f"HeyGen Avatar IV Generation Failed ({response.status_code}): {response.text}")

            res_data = response.json()
            video_id = res_data.get("video_id") or res_data.get("data", {}).get("video_id")
            if not video_id:
                raise RuntimeError(f"HeyGen V3 API returned response without video_id: {res_data}")

            logger.info(f"HeyGen V3 Avatar IV Video Job Created Successfully! video_id={video_id}")
            return video_id

    async def get_video_status(self, heygen_video_id: str) -> Dict[str, Any]:
        """
        Polls HeyGen API v1/v3 for video rendering job status.
        GET /v1/video_status.get?video_id=<heygen_video_id>
        """
        url = f"{self.base_url}/v1/video_status.get?video_id={heygen_video_id}"
        headers = self._get_headers()

        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(url, headers=headers)
            if response.status_code != 200:
                logger.error(f"HeyGen get_video_status failed for {heygen_video_id} with HTTP {response.status_code}: {response.text}")
                raise RuntimeError(f"HeyGen Status Check Failed ({response.status_code}): {response.text}")

            res_data = response.json()
            data = res_data.get("data", {})
            
            raw_status = str(data.get("status", "pending")).lower()
            
            if raw_status in ("completed", "done", "success"):
                status = "COMPLETED"
            elif raw_status in ("failed", "error"):
                status = "FAILED"
            elif raw_status in ("rendering", "processing"):
                status = "RENDERING"
            else:
                status = "QUEUED"

            return {
                "status": status,
                "raw_status": raw_status,
                "video_url": data.get("video_url"),
                "thumbnail_url": data.get("thumbnail_url"),
                "duration": data.get("duration"),
                "error_message": data.get("error")
            }

    async def get_video_status_v3(self, video_id: str) -> Dict[str, Any]:
        """
        Polls video status via GET /v3/videos/{video_id}.
        """
        url = f"{self.base_url}/v3/videos/{video_id}"
        headers = self._get_headers()

        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(url, headers=headers)
            if response.status_code != 200:
                return await self.get_video_status(video_id)

            data = response.json().get("data", response.json())
            raw_status = str(data.get("status", "pending")).lower()

            if raw_status in ("completed", "done", "success"):
                status = "COMPLETED"
            elif raw_status in ("failed", "error"):
                status = "FAILED"
            elif raw_status in ("rendering", "processing"):
                status = "RENDERING"
            else:
                status = "QUEUED"

            return {
                "status": status,
                "raw_status": raw_status,
                "video_url": data.get("video_url") or data.get("url"),
                "thumbnail_url": data.get("thumbnail_url"),
                "duration": data.get("duration"),
                "error_message": data.get("error")
            }

heygen_service = HeyGenService()
