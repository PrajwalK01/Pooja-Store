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

    application.config.update(
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_SECURE=True,      # required on Vercel (HTTPS only)
        SESSION_COOKIE_NAME="7star_session",
        PERMANENT_SESSION_LIFETIME=86400, # 24 hours
        MAX_CONTENT_LENGTH=8 * 1024 * 1024,
    )

    db.init()
    db.migrate_legacy_data()
    register_routes(application)
    return application


app = create_app()


if __name__ == "__main__":
    import os as _os
    _debug = _os.getenv("FLASK_DEBUG", "false").lower() == "true"
    app.run(host="127.0.0.1", port=int(_os.getenv("PORT", 5000)), debug=_debug)