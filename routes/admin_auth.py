"""Admin login, one-time setup signup, and logout endpoints."""
import re

from flask import Blueprint, jsonify, request, session
from werkzeug.security import check_password_hash, generate_password_hash

import db
from config import ADMIN_SETUP_KEY

admin_auth_bp = Blueprint("admin_auth", __name__)


@admin_auth_bp.post("/api/admin/login")
def admin_login():
    data = request.get_json(force=True)
    username = str(data.get("username", "")).strip().lower()
    password = str(data.get("password", ""))
    account = db.get_admin(username) if username else None
    if account and check_password_hash(account["password_hash"], password):
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

    if not db.create_admin(username, generate_password_hash(password)):
        return jsonify({"error": "That username is already in use."}), 409
    session["admin"] = True
    session["admin_username"] = username
    return jsonify({"ok": True}), 201


@admin_auth_bp.post("/api/admin/logout")
def admin_logout():
    session.pop("admin", None)
    session.pop("admin_username", None)
    return jsonify({"ok": True})