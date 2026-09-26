from fastapi import FastAPI, Request, status
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.generate_cv import router as generate_cv_router
from app.api.trajectory_assistance import router as trajectory_assistance_router
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
    app.include_router(trajectory_assistance_router)

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        if request.url.path == "/api/trajectory-assistance/turn":
            fields = {
                str(error["loc"][-1]): "Valor no válido"
                for error in exc.errors()
                if error.get("loc")
            }
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                content={
                    "detail": {
                        "code": "invalid_assistance_request",
                        "message": "La solicitud de asistencia no es válida",
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