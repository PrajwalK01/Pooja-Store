"""Admin booking management endpoints."""
from flask import Blueprint, jsonify, request
from urllib.parse import quote

import db
from .common import admin_required

admin_bookings_bp = Blueprint("admin_bookings", __name__)


def _whatsapp_confirmation_url(booking, settings):
    """Build a WhatsApp message URL to send to the customer."""
    salon = settings.get("salon", "7 Star Salon")
    services = db.list_services()
    svc = next((s for s in services if s["id"] == booking.get("service_id")), None)
    svc_name = svc["name"] if svc else booking.get("service_id", "")

    # Format date as DD/MM/YYYY
    raw_date = booking.get("date", "")
    try:
        y, m, d = raw_date.split("-")
        display_date = f"{d}/{m}/{y}"
    except Exception:
        display_date = raw_date

    msg = (
        f"Dear {booking.get('name', 'Customer')},\n\n"
        f"Your booking at {salon} is CONFIRMED!\n\n"
        f"Booking ID: {booking.get('id', '')}\n"
        f"Service: {svc_name}\n"
        f"Date: {display_date}\n"
        f"Time: {booking.get('time', '')}\n\n"
        f"Please arrive 5 minutes early.\n"
        f"Thank you for choosing {salon}!"
    )

    customer_phone = db._clean_phone(booking.get("phone", ""))
    if not customer_phone:
        return None
    return f"https://wa.me/{customer_phone}?text={quote(msg)}"


@admin_bookings_bp.get("/api/admin/bookings")
@admin_required
def admin_bookings():
    return jsonify({"bookings": db.list_bookings(), "stats": db.stats()})


@admin_bookings_bp.patch("/api/admin/bookings/<booking_id>/status")
@admin_required
def admin_status(booking_id):
    data = request.get_json(force=True)
    status = data.get("status", "")
    ok = db.update_booking_status(booking_id, status)
    if not ok:
        return jsonify({"ok": False}), 400

    wa_url = None
    if status == "confirmed":
        booking = db.get_booking(booking_id)
        if booking:
            settings = db.get_public_settings()
            wa_url = _whatsapp_confirmation_url(booking, settings)

    return jsonify({"ok": True, "whatsapp_url": wa_url})


@admin_bookings_bp.delete("/api/admin/bookings/<booking_id>")
@admin_required
def admin_delete(booking_id):
    return jsonify({"ok": db.delete_booking(booking_id)})
