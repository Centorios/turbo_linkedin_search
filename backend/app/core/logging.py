import json
import logging
import time
from uuid import UUID, uuid4

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response


request_logger = logging.getLogger("cv8.request")

# Extra fields that are safe to print: they never hold user data or provider
# messages. Anything else passed in `extra` stays on the record but is not printed.
SAFE_LOG_FIELDS = ("error_type", "issues")


class SafeExtrasFormatter(logging.Formatter):
    """Appends whitelisted `extra` fields, e.g. `cv_import_failed error_type=APIError`."""

    def format(self, record: logging.LogRecord) -> str:
        message = super().format(record)
        details = " ".join(f"{field}={getattr(record, field)}" for field in SAFE_LOG_FIELDS if hasattr(record, field))
        return f"{message} {details}" if details else message


def configure_logging() -> None:
    """Prints application warnings and errors (loggers under `app.`) with their safe extras."""
    app_logger = logging.getLogger("app")
    if any(isinstance(handler.formatter, SafeExtrasFormatter) for handler in app_logger.handlers):
        return
    handler = logging.StreamHandler()
    handler.setFormatter(SafeExtrasFormatter("%(levelname)s %(name)s: %(message)s"))
    app_logger.addHandler(handler)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = _request_id(request.headers.get("X-Request-ID"))
        started_at = time.perf_counter()
        status_code = 500

        try:
            response = await call_next(request)
            status_code = response.status_code
            response.headers["X-Request-ID"] = request_id
            return response
        finally:
            latency_ms = round((time.perf_counter() - started_at) * 1000, 2)
            outcome_code = "success" if status_code < 400 else "client_error" if status_code < 500 else "server_error"
            event = {
                "request_id": request_id,
                "outcome_code": outcome_code,
                "status_code": status_code,
                "latency_ms": latency_ms,
            }
            request_logger.info(json.dumps(event, separators=(",", ":")), extra=event)


def _request_id(value: str | None) -> str:
    if value:
        try:
            return str(UUID(value))
        except ValueError:
            pass
    return str(uuid4())