from __future__ import annotations

import posixpath
from typing import Optional

import httpx

from app.core.config import settings


class SupabaseStorageError(RuntimeError):
    pass


def _require_supabase_config():
    if not settings.supabase_url:
        raise SupabaseStorageError("SUPABASE_URL is required for STORAGE_PROVIDER=supabase")
    if not settings.supabase_service_role_key:
        raise SupabaseStorageError("SUPABASE_SERVICE_ROLE_KEY is required for STORAGE_PROVIDER=supabase")
    if not settings.supabase_storage_bucket:
        raise SupabaseStorageError("SUPABASE_STORAGE_BUCKET is required for STORAGE_PROVIDER=supabase")


def _auth_headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "apikey": settings.supabase_service_role_key,
    }


def _object_path(*parts: str) -> str:
    cleaned = [p.strip("/").replace("\\", "/") for p in parts if p and p.strip("/")]
    return posixpath.join(*cleaned)


def upload_bytes(*, object_path: str, data: bytes, content_type: str) -> None:
    _require_supabase_config()
    bucket = settings.supabase_storage_bucket
    url = f"{settings.supabase_url.rstrip('/')}/storage/v1/object/{bucket}/{object_path.lstrip('/')}"
    headers = {**_auth_headers(), "Content-Type": content_type, "x-upsert": "true"}
    with httpx.Client(timeout=60.0) as client:
        resp = client.post(url, content=data, headers=headers)
        if resp.status_code >= 300:
            raise SupabaseStorageError(f"Upload failed ({resp.status_code}): {resp.text[:500]}")


def delete_object(*, object_path: str) -> None:
    _require_supabase_config()
    bucket = settings.supabase_storage_bucket
    url = f"{settings.supabase_url.rstrip('/')}/storage/v1/object/{bucket}/{object_path.lstrip('/')}"
    with httpx.Client(timeout=30.0) as client:
        resp = client.delete(url, headers=_auth_headers())
        if resp.status_code not in (200, 204):
            raise SupabaseStorageError(f"Delete failed ({resp.status_code}): {resp.text[:500]}")


def download_bytes(*, object_path: str) -> bytes:
    _require_supabase_config()
    bucket = settings.supabase_storage_bucket
    url = f"{settings.supabase_url.rstrip('/')}/storage/v1/object/{bucket}/{object_path.lstrip('/')}"
    with httpx.Client(timeout=60.0) as client:
        resp = client.get(url, headers=_auth_headers())
        if resp.status_code >= 300:
            raise SupabaseStorageError(f"Download failed ({resp.status_code}): {resp.text[:500]}")
        return resp.content


def create_signed_download_url(*, object_path: str, expires_in: int = 60) -> str:
    _require_supabase_config()
    bucket = settings.supabase_storage_bucket
    url = f"{settings.supabase_url.rstrip('/')}/storage/v1/object/sign/{bucket}/{object_path.lstrip('/')}"
    with httpx.Client(timeout=30.0) as client:
        resp = client.post(url, headers=_auth_headers(), json={"expiresIn": int(expires_in)})
        if resp.status_code >= 300:
            raise SupabaseStorageError(f"Sign URL failed ({resp.status_code}): {resp.text[:500]}")
        data = resp.json()
        signed_path: Optional[str] = data.get("signedURL") if isinstance(data, dict) else None
        if not signed_path:
            raise SupabaseStorageError("Sign URL failed: missing signedURL")
        return f"{settings.supabase_url.rstrip('/')}{signed_path}"


def build_legal_example_object_path(example_id: str, filename: str) -> str:
    return _object_path("legal_examples", example_id, filename)


def build_document_object_path(stored_name: str) -> str:
    return _object_path("documents", stored_name)
