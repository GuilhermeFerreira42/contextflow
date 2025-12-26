
# contextflow/constants.py
import os
import wx

# --- Application Info ---
APP_NAME = "ContextFlow"
APP_VERSION = "0.1.0"

# --- Models ---
MODEL_NAME = "gpt-4o"

# --- Paths ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
EXPORTS_DIR = os.path.join(BASE_DIR, "exports")
DATA_DIR = os.path.join(BASE_DIR, "data")
THUMBNAILS_DIR = os.path.join(DATA_DIR, "thumbs")
DB_PATH = os.path.join(DATA_DIR, "contextflow.db")

# --- UI Colors (Dark Theme) ---
COLOR_BG = wx.Colour(30, 30, 30)
COLOR_FG = wx.Colour(220, 220, 220)
COLOR_HIGHLIGHT = wx.Colour(70, 70, 70)
COLOR_ACCENT = wx.Colour(0, 120, 215)  # Blue accent
