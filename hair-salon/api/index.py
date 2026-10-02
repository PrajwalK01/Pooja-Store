import sys
import os

# Add project root to Python path
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, root)
os.chdir(root)

from app import app

# Vercel requires the variable to be named 'app'
