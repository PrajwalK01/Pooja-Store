"""Data layer -- Firebase / Firestore only.
Supports two ways to provide credentials:
  - FIREBASE_CREDENTIALS_JSON  full JSON string (Render / cloud)
  - FIREBASE_CREDENTIALS       path to a local JSON file (local dev)
"""
import json, uuid, threading
from datetime import datetime
from urllib.parse import quote
import os as _os

from config import (FIREBASE_CREDENTIALS, FIREBASE_CREDENTIALS_JSON,
                    FIREBASE_STORAGE_BUCKET, public_cfg,
                    CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)

_lock = threading.Lock()
_firestore = None
_storage_bucket = None
_firebase_on = False


def init():
    global _firestore, _storage_bucket, _firebase_on
    import firebase_admin
    from firebase_admin import credentials, firestore, storage

    if FIREBASE_CREDENTIALS_JSON:
        try:
            cred_dict = json.loads(FIREBASE_CREDENTIALS_JSON)
        except json.JSONDecodeError as e:
            raise RuntimeError(f"FIREBASE_CREDENTIALS_JSON is not valid JSON: {e}")
        cred = credentials.Certificate(cred_dict)
    elif FIREBASE_CREDENTIALS:
        key_path = _os.path.expandvars(_os.path.expanduser(FIREBASE_CREDENTIALS))
        if not _os.path.isabs(key_path):
            key_path = _os.path.join(_os.path.dirname(__file__), key_path)
        if not _os.path.isfile(key_path):
            raise RuntimeError(f"Firebase credentials file not found: {key_path}")
        cred = credentials.Certificate(key_path)
    else:
        raise RuntimeError(
            "No Firebase credentials found. "
            "Set FIREBASE_CREDENTIALS or FIREBASE_CREDENTIALS_JSON in your environment."
        )

    try:
        firebase_app = firebase_admin.get_app()
    except ValueError:
        firebase_app = firebase_admin.initialize_app(cred)

    _firestore = firestore.client(firebase_app)
    _storage_bucket = (
        storage.bucket(FIREBASE_STORAGE_BUCKET, app=firebase_app)
        if FIREBASE_STORAGE_BUCKET else None
    )
    _firebase_on = True
    print("Firebase connected -- Firestore is live.")


def firebase_on():
    return _firebase_on


def firebase_storage_on():
    return _firebase_on and _storage_bucket is not None


def upload_gallery_image(stream, object_name, content_type):
    if not firebase_storage_on():
        raise RuntimeError("Firebase Storage not configured. Set FIREBASE_STORAGE_BUCKET.")
    blob = _storage_bucket.blob(object_name)
    stream.seek(0)
    blob.upload_from_file(stream, content_type=content_type, rewind=True)
    token = uuid.uuid4().hex
    blob.metadata = {"firebaseStorageDownloadTokens": token}
    blob.patch()
    return (
        f"https://firebasestorage.googleapis.com/v0/b/{_storage_bucket.name}/o/"
        f"{quote(object_name, safe='')}?alt=media&token={token}"
    )


def delete_gallery_image(object_name):
    if not firebase_storage_on():
        return False
    _storage_bucket.blob(object_name).delete()
    return True


# ---------- Cloudinary ----------

def cloudinary_on():
    return bool(CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET)


def upload_cloudinary_image(stream, public_id, content_type):
    """Upload image to Cloudinary and return the secure URL."""
    import cloudinary
    import cloudinary.uploader
    cloudinary.config(
        cloud_name=CLOUDINARY_CLOUD_NAME,
        api_key=CLOUDINARY_API_KEY,
        api_secret=CLOUDINARY_API_SECRET,
    )
    stream.seek(0)
    result = cloudinary.uploader.upload(
        stream,
        public_id=public_id,
        folder="7-star-salon",
        overwrite=True,
        resource_type="image",
    )
    return result["secure_url"]


def delete_cloudinary_image(public_id):
    """Delete image from Cloudinary."""
    try:
        import cloudinary
        import cloudinary.uploader
        cloudinary.config(
            cloud_name=CLOUDINARY_CLOUD_NAME,
            api_key=CLOUDINARY_API_KEY,
            api_secret=CLOUDINARY_API_SECRET,
        )
        cloudinary.uploader.destroy(public_id)
        return True
    except Exception:
        return False


def _col(name):
    return _firestore.collection(name)


def migrate_legacy_data():
    settings_ref = _col("settings").document("public")
    snap = settings_ref.get()
    if not snap.exists:
        settings_ref.set(public_cfg())
    else:
        data = snap.to_dict()
        if "services" in data:
            data.pop("services")
            settings_ref.set(data)


def get_public_settings():
    snap = _col("settings").document("public").get()
    stored = snap.to_dict() if snap.exists else {}
    return {**public_cfg(), **stored}


def save_public_settings(settings):
    record = {**settings, "updated": datetime.now().isoformat()}
    _col("settings").document("public").set(record)
    return record


def list_services():
    return [doc.to_dict() for doc in _col("services").stream()]


def save_service(service, service_id=None):
    service_id = service_id or uuid.uuid4().hex[:12]
    record = {**service, "id": service_id, "updated": datetime.now().isoformat()}
    _col("services").document(service_id).set(record)
    return record


def delete_service(service_id):
    ref = _col("services").document(service_id)
    if not ref.get().exists:
        return False
    ref.delete()
    return True


def list_gallery():
    return sorted(
        (doc.to_dict() for doc in _col("gallery").stream()),
        key=lambda p: p.get("created", ""),
    )


def add_gallery_photo(photo):
    photo_id = uuid.uuid4().hex[:12]
    record = {**photo, "id": photo_id, "created": datetime.now().isoformat()}
    _col("gallery").document(photo_id).set(record)
    return record


def delete_gallery_photo(photo_id):
    ref = _col("gallery").document(photo_id)
    snap = ref.get()
    if not snap.exists:
        return None
    ref.delete()
    return snap.to_dict()


def get_admin(username):
    snap = _col("admins").document(username.lower()).get()
    return snap.to_dict() if snap.exists else None


def admin_count():
    return sum(1 for _ in _col("admins").limit(1).stream())


def create_admin(username, password_hash):
    username = username.lower()
    ref = _col("admins").document(username)
    if ref.get().exists:
        return False
    ref.set({"username": username, "password_hash": password_hash,
             "created": datetime.now().isoformat()})
    return True


def _slot_ok(date_str, time_str, stylist_id):
    settings = get_public_settings()
    stylists = settings.get("stylists", [])
    hours = settings.get("hours", {})
    if stylist_id not in {s["id"] for s in stylists}:
        return False, "Unknown stylist."
    try:
        dt = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
    except ValueError:
        return False, "Invalid date or time."
    if dt < datetime.now():
        return False, "That time has already passed."
    today_hours = hours.get(str(dt.weekday()))
    if today_hours is None:
        return False, "We are closed that day."
    h = dt.hour + dt.minute / 60
    if not (today_hours[0] <= h < today_hours[1]):
        return False, "Outside business hours."
    return True, None


def create_booking(data):
    ok, err = _slot_ok(data["date"], data["time"], data["stylist_id"])
    if not ok:
        return None, err
    with _lock:
        clash = list(
            _col("bookings")
            .where("date", "==", data["date"])
            .where("time", "==", data["time"])
            .where("stylist_id", "==", data["stylist_id"])
            .where("status", "in", ["pending", "confirmed"])
            .stream()
        )
        if clash:
            return None, "That slot was just taken -- please pick another time."
        bid = _col("bookings").document().id
        _col("bookings").document(bid).set({
            **data, "id": bid, "status": "pending",
            "created": datetime.now().isoformat(),
        })
    return bid, None


def list_bookings():
    return [d.to_dict() for d in _col("bookings").order_by("created").stream()]


def update_booking_status(bid, status):
    if status not in ("pending", "confirmed", "done", "cancelled"):
        return False
    _col("bookings").document(bid).update({"status": status})
    return True


def delete_booking(bid):
    _col("bookings").document(bid).delete()
    return True


def taken_slots(date_str, stylist_id):
    snap = (
        _col("bookings")
        .where("date", "==", date_str)
        .where("stylist_id", "==", stylist_id)
        .where("status", "in", ["pending", "confirmed"])
        .stream()
    )
    return [d.to_dict()["time"] for d in snap]


def add_review(data):
    rid = uuid.uuid4().hex[:10]
    rec = {**data, "id": rid, "created": datetime.now().isoformat()}
    _col("reviews").document(rid).set(rec)
    return rid


def list_reviews():
    snap = _col("reviews").order_by("created", direction="DESCENDING").stream()
    return [d.to_dict() for d in snap]


def stats():
    bs = list_bookings()
    return {
        "total":     len(bs),
        "pending":   sum(1 for b in bs if b["status"] == "pending"),
        "confirmed": sum(1 for b in bs if b["status"] == "confirmed"),
        "done":      sum(1 for b in bs if b["status"] == "done"),
        "cancelled": sum(1 for b in bs if b["status"] == "cancelled"),
        "firebase":  True,
    }
