from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import Client

from app.core.supabase import get_auth_client


bearer_scheme = HTTPBearer(auto_error=False)


async def require_user_id(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    client: Annotated[Client, Depends(get_auth_client)],
) -> str:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Tenés que iniciar sesión.")

    try:
        response = client.auth.get_user(credentials.credentials)
        user = response.user
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Tu sesión no es válida. Volvé a iniciar sesión.") from exc

    if user is None or not user.id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Tu sesión no es válida. Volvé a iniciar sesión.")
    return str(user.id)
