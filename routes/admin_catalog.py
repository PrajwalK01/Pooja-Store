"""Admin APIs for services, salon settings, and gallery management."""
import re
import uuid
from pathlib import Path

from flask import Blueprint, current_app, jsonify, request, url_for
from werkzeug.utils import secure_filename

import db
from .common import admin_required

admin_catalog_bp = Blueprint("admin_catalog", __name__)


def service_payload(data):
    name = str(data.get("name", "")).strip()[:60]
    description = str(data.get("desc", "")).strip()[:240]
    icon = str(data.get("icon", "")).strip()[:8]
    try:
        price = int(data.get("price", 0))
        minutes = int(data.get("mins", 0))
    except (TypeError, ValueError):
        return None, "Price and duration must be whole numbers."
    if not name or not description or not icon:
        return None, "Name, description, and icon are required."
    if not 1 <= price <= 1000000:
        return None, "Price must be a positive number."
    # Duration is hidden in the Pooja Store UI; clamp silently to valid range
    minutes = max(10, min(600, minutes)) if minutes != 0 else 10
    return {"name": name, "desc": description, "icon": icon, "price": price, "mins": minutes}, None


def settings_payload(data):
    salon = str(data.get("salon", "")).strip()[:80]
    maps_query = str(data.get("maps_query", "")).strip()[:180]
    whatsapp = re.sub(r"\D", "", str(data.get("whatsapp", "")))[:15]
    currency = str(data.get("currency", "")).strip()[:8]
    stylists_data = data.get("stylists")
    hours_data = data.get("hours")

    # Capacity and lunch break
    try:
        max_per_slot = int(data.get("max_per_slot", 1))
        if not 1 <= max_per_slot <= 50:
            return None, "Max bookings per slot must be between 1 and 50."
    except (TypeError, ValueError):
        return None, "Max bookings per slot must be a number."

    lunch_start = data.get("lunch_start")
    lunch_end   = data.get("lunch_end")
    if lunch_start is not None and lunch_end is not None:
        try:
            lunch_start = int(lunch_start)
            lunch_end   = int(lunch_end)
            if not (0 <= lunch_start < lunch_end <= 24):
                return None, "Lunch break end must be after start."
        except (TypeError, ValueError):
            return None, "Lunch break times must be valid hours."
    else:
        lunch_start = None
        lunch_end   = None
    if not salon or not currency:
        return None, "Salon name and currency symbol are required."
    if whatsapp and not 8 <= len(whatsapp) <= 15:
        return None, "WhatsApp number must include country code and contain 8-15 digits."
    if not isinstance(stylists_data, list) or len(stylists_data) > 24:
        return None, "Add up to 24 stylists."

    stylists = []
    stylist_ids = set()
    for item in stylists_data:
        stylist_id = str(item.get("id", "")).strip().lower()
        name = str(item.get("name", "")).strip()[:60]
        role = str(item.get("role", "")).strip()[:80]
        tag = str(item.get("tag", "")).strip()[:120]
        if not re.fullmatch(r"[a-z0-9_-]{2,40}", stylist_id) or stylist_id in stylist_ids:
            return None, "Each stylist needs a unique ID using letters, numbers, dashes, or underscores."
        if not name or not role or not tag:
            return None, "Every stylist needs a name, role, and specialty."
        stylist_ids.add(stylist_id)
        stylists.append({"id": stylist_id, "name": name, "role": role, "tag": tag})
    if not stylists:
        return None, "At least one stylist is required."
    if not isinstance(hours_data, dict):
        return None, "Opening hours must include all days of the week."

    hours = {}
    for day in range(7):
        value = hours_data.get(str(day))
        if value is None:
            hours[str(day)] = None
            continue
        if not isinstance(value, list) or len(value) != 2 or any(type(hour) is not int for hour in value):
            return None, "Each open day needs opening and closing hours."
        opening, closing = value
        if not 0 <= opening < closing <= 24:
            return None, "Opening hours must be valid whole hours, with closing after opening."
        hours[str(day)] = [opening, closing]

    current = db.get_public_settings()
    return {
        "salon": salon,
        "maps_query": maps_query,
        "whatsapp": whatsapp,
        "currency": currency,
        "stylists": stylists,
        "hours": hours,
        "max_per_slot": max_per_slot,
        "lunch_start": lunch_start,
        "lunch_end": lunch_end,
    }, None


@admin_catalog_bp.route("/api/admin/settings", methods=["GET", "PUT"])
@admin_required
def admin_settings():
    if request.method == "GET":
        return jsonify({"settings": db.get_public_settings()})
    settings, error = settings_payload(request.get_json(force=True))
    if error:
        return jsonify({"error": error}), 400
    return jsonify({"settings": db.save_public_settings(settings)})


@admin_catalog_bp.route("/api/admin/services", methods=["GET", "POST"])
@admin_required
def admin_services():
    if request.method == "GET":
        return jsonify({"services": db.list_services()})
    service, error = service_payload(request.get_json(force=True))
    if error:
        return jsonify({"error": error}), 400
    return jsonify({"service": db.save_service(service)}), 201


@admin_catalog_bp.route("/api/admin/services/<service_id>", methods=["PUT", "DELETE"])
@admin_required
def admin_service(service_id):
    if request.method == "DELETE":
        return jsonify({"ok": db.delete_service(service_id)})
    service, error = service_payload(request.get_json(force=True))
    if error:
        return jsonify({"error": error}), 400
    if service_id not in {item["id"] for item in db.list_services()}:
        return jsonify({"error": "Service not found."}), 404
    return jsonify({"service": db.save_service(service, service_id)})


@admin_catalog_bp.route("/api/admin/gallery", methods=["GET", "POST"])
@admin_required
def admin_gallery():
    if request.method == "GET":
        photos = db.list_gallery()
        for photo in photos:
            photo["src"] = photo.get("src") or url_for("static", filename=f"images/{photo['filename']}")
        return jsonify({"photos": photos})

    upload = request.files.get("photo")
    title = str(request.form.get("title", "")).strip()[:80]
    stylist = str(request.form.get("stylist", "")).strip()[:60]
    extension = Path(secure_filename(upload.filename or "")).suffix.lower() if upload else ""
    signatures = {
        ".jpg": lambda content: content.startswith(b"\xff\xd8\xff"),
        ".jpeg": lambda content: content.startswith(b"\xff\xd8\xff"),
        ".png": lambda content: content.startswith(b"\x89PNG\r\n\x1a\n"),
        ".webp": lambda content: content.startswith(b"RIFF") and content[8:12] == b"WEBP",
    }
    if not upload or not title or extension not in signatures:
        return jsonify({"error": "Choose a JPG, PNG, or WebP photo and enter a title."}), 400
    header = upload.stream.read(16)
    upload.stream.seek(0)
    if not signatures[extension](header):
        return jsonify({"error": "The uploaded file does not match its image type."}), 400

    photo_id = uuid.uuid4().hex[:12]
    photo_data = {"filename": f"uploads/{photo_id}{extension}", "title": title, "stylist": stylist}

    # Priority: Cloudinary → Firebase Storage → local disk
    if db.cloudinary_on():
        try:
            public_id = f"7-star-salon/{photo_id}"
            photo_data["src"] = db.upload_cloudinary_image(upload.stream, public_id, upload.mimetype)
            photo_data["cloudinary_id"] = public_id
        except Exception as e:
            return jsonify({"error": f"Cloudinary upload failed: {str(e)}"}), 502
    elif db.firebase_storage_on():
        try:
            photo_data["storage_path"] = f"gallery/{photo_id}{extension}"
            photo_data["src"] = db.upload_gallery_image(upload.stream, photo_data["storage_path"], upload.mimetype)
        except Exception as e:
            # Firebase Storage bucket not available — fall back to local disk
            photo_data.pop("storage_path", None)
            stored_name = f"uploads/{photo_id}{extension}"
            target = Path(current_app.static_folder) / "images" / stored_name
            target.parent.mkdir(parents=True, exist_ok=True)
            upload.stream.seek(0)
            upload.save(target)
    else:
        # local disk fallback
        stored_name = f"uploads/{photo_id}{extension}"
        target = Path(current_app.static_folder) / "images" / stored_name
        target.parent.mkdir(parents=True, exist_ok=True)
        upload.stream.seek(0)
        upload.save(target)

    try:
        photo = db.add_gallery_photo(photo_data)
    except Exception:
        # rollback
        if photo_data.get("cloudinary_id"):
            db.delete_cloudinary_image(photo_data["cloudinary_id"])
        elif photo_data.get("storage_path"):
            db.delete_gallery_image(photo_data["storage_path"])
        raise
    return jsonify({"photo": photo}), 201


@admin_catalog_bp.delete("/api/admin/gallery/<photo_id>")
@admin_required
def admin_delete_gallery_photo(photo_id):
    photo = db.delete_gallery_photo(photo_id)
    if not photo:
        return jsonify({"error": "Photo not found."}), 404
    # Delete from Cloudinary
    if photo.get("cloudinary_id"):
        db.delete_cloudinary_image(photo["cloudinary_id"])
    # Delete from Firebase Storage
    elif photo.get("storage_path"):
        try:
            db.delete_gallery_image(photo["storage_path"])
        except Exception:
            return jsonify({"error": "Photo record removed, but Storage object could not be deleted."}), 502
    # Delete from local disk
    elif str(photo.get("filename", "")).startswith("uploads/"):
        target = (Path(current_app.static_folder) / "images" / photo["filename"]).resolve()
        upload_dir = (Path(current_app.static_folder) / "images" / "uploads").resolve()
        if target.parent == upload_dir:
            target.unlink(missing_ok=True)
    return jsonify({"ok": True})