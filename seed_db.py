"""
One-time Firestore seed script for Gayathri Pooja Store.
Run this AFTER clearing all Firestore collections.

Usage:
    .venv\Scripts\python.exe seed_db.py
"""
import uuid
from datetime import datetime
from dotenv import load_dotenv
load_dotenv()

# ── Firebase init ──────────────────────────────────────────
import firebase_admin
from firebase_admin import credentials, firestore
import config

cred = credentials.Certificate(config.FIREBASE_CREDENTIALS)
try:
    app = firebase_admin.get_app()
except ValueError:
    app = firebase_admin.initialize_app(cred)

db = firestore.client(app)
print("✅ Firebase connected:", app.project_id)


# ── Admin account (werkzeug hashed password — same as the app uses) ──
from werkzeug.security import generate_password_hash

USERNAME  = "chandan"          # login username (always lowercase)
PASSWORD  = "Gayathri@2026"    # login password

hashed = generate_password_hash(PASSWORD)
db.collection("admins").document(USERNAME).set({
    "username": USERNAME,
    "password_hash": hashed,
    "created": datetime.now().isoformat(),
})
print(f"✅ Admin created — username: {USERNAME}  password: {PASSWORD}")


# ── Store settings ────────────────────────────────────────
db.collection("settings").document("public").set({
    "salon":        "Gayathri Pooja Store",
    "currency":     "₹",
    "whatsapp":     "919108622221",
    "maps_query":   "Gayathri Pooja Store",
    "stylists": [
        {
            "id":   "chandan",
            "name": "Chandan",
            "role": "Store Owner",
            "tag":  "All pooja items",
        }
    ],
    "hours": {
        "0": [9, 21],   # Monday    9 AM – 9 PM
        "1": [9, 21],   # Tuesday
        "2": [9, 21],   # Wednesday
        "3": [9, 21],   # Thursday
        "4": [9, 21],   # Friday
        "5": [8, 22],   # Saturday  8 AM – 10 PM
        "6": [8, 22],   # Sunday
    },
    "max_per_slot": 10,
    "lunch_start":  13,   # 1 PM
    "lunch_end":    14,   # 2 PM
    "updated": datetime.now().isoformat(),
})
print("✅ Store settings saved")


# ── Delete ALL existing products first ────────────────────
existing = db.collection("services").stream()
deleted = 0
for doc in existing:
    doc.reference.delete()
    deleted += 1
print(f"🗑  Deleted {deleted} old products")

# ── Add exact 30 Pooja items ───────────────────────────────
products = [
    {"name": "Kumkum",                  "desc": "Pure red kumkum powder for tilak and pooja rituals.",              "price": 10,  "icon": "🔴"},
    {"name": "Haldi / Turmeric",        "desc": "Fresh turmeric powder for auspicious pooja ceremonies.",           "price": 10,  "icon": "�"},
    {"name": "Akshata / Rice",          "desc": "Sacred rice grains used for blessings and offerings.",             "price": 10,  "icon": "🍚"},
    {"name": "Cotton Wicks",            "desc": "Pure white cotton wicks for diya and lamp lighting.",              "price": 10,  "icon": "🕯️"},
    {"name": "Camphor / Kapoor",        "desc": "Pure camphor tablets for aarti and ritual purification.",          "price": 20,  "icon": "⚪"},
    {"name": "Agarbatti",               "desc": "Fragrant incense sticks for daily pooja and meditation.",          "price": 20,  "icon": "🌿"},
    {"name": "Dhoop Sticks",            "desc": "Thick dhoop sticks with rich divine fragrance.",                   "price": 20,  "icon": "✨"},
    {"name": "Matchbox",                "desc": "Safety matchbox for lighting diyas and agarbatti.",                "price": 5,   "icon": "🔥"},
    {"name": "Sandalwood Powder",       "desc": "Pure chandan powder for tilak, paste and idol decoration.",        "price": 20,  "icon": "🟤"},
    {"name": "Vibhuti",                 "desc": "Sacred holy ash (vibhuti) for forehead and pooja use.",            "price": 20,  "icon": "🌫️"},
    {"name": "Sindoor",                 "desc": "Bright red sindoor powder for auspicious rituals.",                "price": 10,  "icon": "❤️"},
    {"name": "Chandan",                 "desc": "Sandalwood chandan stick for paste making and fragrance.",         "price": 20,  "icon": "�"},
    {"name": "Moli / Kalava",           "desc": "Sacred red-yellow thread tied during pooja ceremonies.",           "price": 10,  "icon": "🧵"},
    {"name": "Betel Nut / Supari",      "desc": "Whole betel nuts for offering to deities in rituals.",             "price": 20,  "icon": "🟫"},
    {"name": "Cloves / Lavang",         "desc": "Aromatic cloves used in pooja and havan rituals.",                 "price": 20,  "icon": "🌱"},
    {"name": "Cardamom / Elaichi",      "desc": "Green cardamom pods for pooja offerings and prasad.",              "price": 30,  "icon": "💚"},
    {"name": "Dry Coconut",             "desc": "Dried whole coconut for ritual offerings and prasad.",             "price": 30,  "icon": "🥥"},
    {"name": "Turmeric Root / Arishina","desc": "Whole turmeric root for Gowri pooja and auspicious rituals.",     "price": 20,  "icon": "🌾"},
    {"name": "Betel Leaves / Beeda",    "desc": "Fresh betel leaves for deity offerings and pooja.",               "price": 20,  "icon": "🍃"},
    {"name": "Flowers",                 "desc": "Fresh marigold and mixed flowers for deity decoration.",           "price": 30,  "icon": "🌼"},
    {"name": "Mango Leaves",            "desc": "Fresh mango leaves for torana and kalash decoration.",            "price": 25,  "icon": "🌿"},
    {"name": "Banana",                  "desc": "Ripe bananas for naivedyam and deity offerings.",                  "price": 15,  "icon": "🍌"},
    {"name": "Coconut",                 "desc": "Fresh whole coconut for pooja and breaking during rituals.",       "price": 35,  "icon": "🥥"},
    {"name": "Pooja Oil",               "desc": "Pure sesame or coconut oil for diya lighting.",                    "price": 35,  "icon": "�"},
    {"name": "Ghee",                    "desc": "Pure cow ghee for havan, diya and prasad preparation.",            "price": 40,  "icon": "🧈"},
    {"name": "Small Clay Diya",         "desc": "Handmade earthen clay diya for daily pooja and festivals.",        "price": 20,  "icon": "🪔"},
    {"name": "Brass Kumkum Bowl",       "desc": "Small brass bowl for storing kumkum on the pooja thali.",         "price": 38,  "icon": "🏺"},
    {"name": "Small Pooja Bowl",        "desc": "Brass/metal small bowl for water or milk offerings.",              "price": 38,  "icon": "🥣"},
    {"name": "Small Agarbatti Stand",   "desc": "Compact incense stick holder for safe agarbatti burning.",        "price": 40,  "icon": "�️"},
    {"name": "Small Diya Set",          "desc": "Set of 6 small clay diyas for decorative pooja lighting.",        "price": 35,  "icon": "🪔"},
]

for p in products:
    sid = uuid.uuid4().hex[:12]
    db.collection("services").document(sid).set({
        "name":    p["name"],
        "desc":    p["desc"],
        "price":   p["price"],
        "icon":    p["icon"],
        "mins":    10,
        "id":      sid,
        "updated": datetime.now().isoformat(),
    })
print(f"✅ {len(products)} products added")


print("\n🙏 Seed complete! You can now log in at http://127.0.0.1:5000/admin/login")
print(f"   Username : {USERNAME}")
print(f"   Password : {PASSWORD}")
