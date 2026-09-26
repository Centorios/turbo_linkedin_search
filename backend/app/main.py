from fastapi import FastAPI, Request
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.generate_cv import router as generate_cv_router
from app.api.profile import router as profile_router
from app.core.logging import RequestLoggingMiddleware
from app.core.settings import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="CV8 API")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(RequestLoggingMiddleware)
    app.include_router(generate_cv_router)
    app.include_router(profile_router)

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        if request.url.path in {"/api/profile", "/api/profile/"}:
            fields = {
                str(error["loc"][-1]): "Valor no válido"
                for error in exc.errors()
                if error.get("loc") and error["loc"][-1] in {
                    "fullName",
                    "email",
                    "phone",
                    "location",
                    "linkedin",
                    "website",
                }
            }
            return JSONResponse(
                status_code=422,
                content={
                    "detail": {
                        "code": "invalid_profile",
                        "message": "Los datos del perfil no son válidos",
                        "fields": fields,
                    }
                },
            )
        return await request_validation_exception_handler(request, exc)

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()