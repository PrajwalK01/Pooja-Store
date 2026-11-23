"""Admin login, one-time setup signup, and logout endpoints."""
import re
import threading
import time
from collections import defaultdict

from flask import Blueprint, jsonify, request, session
from werkzeug.security import check_password_hash, generate_password_hash

import db
from config import ADMIN_SETUP_KEY

admin_auth_bp = Blueprint("admin_auth", __name__)

# ---------------------------------------------------------------------------
# Rate limiter for login (3 attempts per minute per IP)
# ---------------------------------------------------------------------------
_login_lock = threading.Lock()
_login_store: dict[str, list[float]] = defaultdict(list)

_LOGIN_MAX = 3
_LOGIN_WINDOW = 60  # seconds


def _check_login_rate(ip: str) -> bool:
    """Return True if the login attempt is allowed."""
    now = time.monotonic()
    cutoff = now - _LOGIN_WINDOW
    with _login_lock:
        timestamps = _login_store[ip]
        timestamps[:] = [t for t in timestamps if t > cutoff]
        if len(timestamps) >= _LOGIN_MAX:
            return False
        timestamps.append(now)
    return True


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@admin_auth_bp.post("/api/admin/login")
def admin_login():
    ip = request.headers.get("X-Forwarded-For", request.remote_addr or "").split(",")[0].strip()
    if not _check_login_rate(ip):
        return jsonify({"ok": False, "error": "Too many login attempts. Please wait a minute."}), 429

    data = request.get_json(force=True)
    username = str(data.get("username", "")).strip().lower()
    password = str(data.get("password", ""))
    account = db.get_admin(username) if username else None
    if account and check_password_hash(account["password_hash"], password):
        # Regenerate session to prevent session fixation
        session.clear()
        session.permanent = True
        session["admin"] = True
        session["admin_username"] = username
        return jsonify({"ok": True})
    return jsonify({"ok": False}), 401


@admin_auth_bp.post("/api/admin/signup")
def admin_signup():
    data = request.get_json(force=True)
    username = str(data.get("username", "")).strip().lower()
    password = str(data.get("password", ""))
    first_admin = db.admin_count() == 0

    if not re.fullmatch(r"[a-z0-9_.-]{3,32}", username):
        return jsonify({"error": "Username must be 3-32 characters: letters, numbers, dot, dash, or underscore."}), 400
    if len(password) < 10:
        return jsonify({"error": "Password must be at least 10 characters."}), 400
    if first_admin:
        if not ADMIN_SETUP_KEY or data.get("setup_key", "") != ADMIN_SETUP_KEY:
            return jsonify({"error": "The admin setup key is missing or incorrect."}), 403
    elif not session.get("admin"):
        return jsonify({"error": "Only a signed-in admin can create another admin account."}), 403

    # Always use pbkdf2:sha256 when creating passwords
    pw_hash = generate_password_hash(password, method="pbkdf2:sha256")
    if not db.create_admin(username, pw_hash):
        return jsonify({"error": "That username is already in use."}), 409
    session.clear()
    session.permanent = True
    session["admin"] = True
    session["admin_username"] = username
    return jsonify({"ok": True}), 201


@admin_auth_bp.post("/api/admin/logout")
def admin_logout():
    session.clear()          # wipe the entire session, not just individual keys
    return jsonify({"ok": True})
