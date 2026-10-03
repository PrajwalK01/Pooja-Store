"""Public booking availability, booking creation, and review endpoints."""
from flask import Blueprint, jsonify, request

import db

public_api_bp = Blueprint("public_api", __name__)


@public_api_bp.get("/api/availability")
def availability():
    date = request.args.get("date", "")
    stylist = request.args.get("stylist", "")
    if not date or not stylist:
        return jsonify({"error": "date and stylist required"}), 400
    return jsonify({"taken": db.taken_slots(date, stylist)})


@public_api_bp.post("/api/bookings")
def create_booking():
    data = request.get_json(force=True)
    for field in ("name", "phone", "service_id", "stylist_id", "date", "time"):
        if not str(data.get(field, "")).strip():
            return jsonify({"error": f"Missing field: {field}"}), 400

    available_ids = {service["id"] for service in db.list_services()}

    # Accept single service_id (original) OR service_ids array (multi-select)
    service_ids = data.get("service_ids")
    if isinstance(service_ids, list) and len(service_ids) > 0:
        invalid = [sid for sid in service_ids if sid not in available_ids]
        if invalid:
            return jsonify({"error": "One or more selected items are not available."}), 400
    else:
        # Fall back to single service_id
        if data["service_id"] not in available_ids:
            return jsonify({"error": "Please choose an available item."}), 400

    valid, error = db._slot_ok(data["date"], data["time"], data["stylist_id"])
    if not valid:
        return jsonify({"error": error}), 400

    booking_id, error = db.create_booking({
        "name":       data["name"].strip()[:60],
        "phone":      data["phone"].strip()[:30],
        "service_id": data["service_id"],
        "stylist_id": data["stylist_id"],
        "notes":      str(data.get("notes", ""))[:300],
        "date":       data["date"],
        "time":       data["time"],
    })
    if error:
        return jsonify({"error": error}), 409
    return jsonify({"id": booking_id, "message": "Order received. We will contact you soon."}), 201


@public_api_bp.route("/api/reviews", methods=["GET", "POST"])
def reviews():
    if request.method == "POST":
        data = request.get_json(force=True)
        name = data.get("name", "").strip()
        rating = data.get("rating")
        text = data.get("text", "").strip()
        if not name or not text or not isinstance(rating, int) or not 1 <= rating <= 5:
            return jsonify({"error": "Name, 1-5 stars and a review are required."}), 400
        review_id = db.add_review({"name": name[:40], "rating": rating, "text": text[:280]})
        return jsonify({"id": review_id, "message": "Review submitted."}), 201
    return jsonify({"reviews": db.list_reviews()})