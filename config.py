"""Environment-provided secrets and salon settings."""
import os
from dotenv import load_dotenv

load_dotenv()

ADMIN_SETUP_KEY           = os.getenv("ADMIN_SETUP_KEY", "").strip()
FIREBASE_CREDENTIALS      = os.getenv("FIREBASE_CREDENTIALS", "").strip()
FIREBASE_CREDENTIALS_JSON = os.getenv("FIREBASE_CREDENTIALS_JSON", "").strip()
FIREBASE_STORAGE_BUCKET   = os.getenv("FIREBASE_STORAGE_BUCKET", "").strip()
WHATSAPP_NUMBER           = os.getenv("WHATSAPP_NUMBER", "").strip()
MAPS_QUERY                = os.getenv("MAPS_QUERY", "").strip()
SALON_NAME                = os.getenv("SALON_NAME", "").strip()
CURRENCY_SYMBOL           = os.getenv("CURRENCY_SYMBOL", "").strip()

# Cloudinary
CLOUDINARY_CLOUD_NAME     = os.getenv("CLOUDINARY_CLOUD_NAME", "").strip()
CLOUDINARY_API_KEY        = os.getenv("CLOUDINARY_API_KEY", "").strip()
CLOUDINARY_API_SECRET     = os.getenv("CLOUDINARY_API_SECRET", "").strip()


def public_cfg():
    return {
        "salon":      SALON_NAME,
        "currency":   CURRENCY_SYMBOL,
        "whatsapp":   WHATSAPP_NUMBER,
        "maps_query": MAPS_QUERY,
        "stylists":   [],
        "hours":      {},
    }
