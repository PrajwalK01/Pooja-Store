"""Flask application setup and route registration."""
import os

from flask import Flask

import db
from routes import register_routes


def create_app():
    application = Flask(__name__)

    secret = os.getenv("FLASK_SECRET_KEY", "").strip()
    if not secret:
        raise RuntimeError("FLASK_SECRET_KEY environment variable is not set.")
    application.secret_key = secret

    is_production = os.getenv("FLASK_ENV", "").strip().lower() == "production"

    application.config.update(
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_SECURE=is_production,   # True in prod (HTTPS), False for local dev
        SESSION_COOKIE_NAME="7star_session",
        PERMANENT_SESSION_LIFETIME=86400,       # 24 hours
        MAX_CONTENT_LENGTH=8 * 1024 * 1024,
    )

    @application.after_request
    def add_security_headers(response):
        # Prevent MIME-type sniffing
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        # Clickjacking protection
        response.headers.setdefault("X-Frame-Options", "DENY")
        # Basic CSP – tighten per-environment as needed
        response.headers.setdefault(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; "
            "object-src 'none'; frame-ancestors 'none';",
        )
        # Only send HSTS in production (HTTPS environments)
        if is_production:
            response.headers.setdefault(
                "Strict-Transport-Security",
                "max-age=31536000; includeSubDomains; preload",
            )
        # Additional privacy / capability headers
        response.headers.setdefault(
            "Referrer-Policy", "strict-origin-when-cross-origin"
        )
        response.headers.setdefault(
            "Permissions-Policy", "camera=(), microphone=()"
        )
        return response

    db.init()
    db.migrate_legacy_data()
    register_routes(application)
    return application


app = create_app()


if __name__ == "__main__":
    import os as _os
    _debug = _os.getenv("FLASK_DEBUG", "false").lower() == "true"
    app.run(host="127.0.0.1", port=int(_os.getenv("PORT", 5000)), debug=_debug)
