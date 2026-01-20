import os
import uuid
from app.core.config import settings
from app.services.supabase_storage import (
    SupabaseStorageError,
    build_document_object_path,
    upload_bytes,
)

def uploads_dir() -> str:
    return os.path.join(settings.data_dir, "uploads")

def save_upload_bytes(content: bytes, original_name: str, content_type: str = "application/octet-stream") -> str:
    if settings.app_env != "local" and settings.storage_provider != "supabase":
        raise RuntimeError(
            "Misconfiguration: STORAGE_PROVIDER must be 'supabase' in non-local environments (Render filesystem is ephemeral)."
        )

    ext = ""
    if "." in original_name:
        ext = "." + original_name.split(".")[-1].lower()
    safe_name = f"{uuid.uuid4().hex}{ext}"

    if settings.storage_provider == "supabase":
        try:
            object_path = build_document_object_path(safe_name)
            upload_bytes(object_path=object_path, data=content, content_type=content_type or "application/octet-stream")
            return object_path
        except SupabaseStorageError as e:
            raise RuntimeError(str(e))

    path = os.path.join(uploads_dir(), safe_name)
    with open(path, "wb") as f:
        f.write(content)
    return safe_name

def file_path(stored_name: str) -> str:
    return os.path.join(uploads_dir(), stored_name)
