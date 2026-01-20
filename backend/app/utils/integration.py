from fastapi import Header, HTTPException, status

from app.core.config import settings


def require_integration_key(x_integration_key: str = Header(None)):
    if not settings.integration_key:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Integration key not configured")
    if not x_integration_key or x_integration_key != settings.integration_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid integration key")
    return True
