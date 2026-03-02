
# contextflow/constants.py
import os
import wx

# --- Application Info ---
APP_NAME = "ContextFlow"
APP_VERSION = "0.1.0"

# --- Models ---
MODEL_NAME = "gpt-4o"

# --- Paths ---
# [PORTABILIDADE] Resolução dinâmica de caminhos baseada na localização do script.
# Garante que o app encontre /config e /data independente da pasta de instalação.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

EXPORTS_DIR = os.path.join(BASE_DIR, "exports")
CONFIG_DIR = os.path.join(BASE_DIR, "config")
DATA_DIR = os.path.join(BASE_DIR, "data")
THUMBNAILS_DIR = os.path.join(DATA_DIR, "thumbs")
DB_PATH = os.path.join(DATA_DIR, "contextflow.db")
AI_PRICES_PATH = os.path.join(CONFIG_DIR, "ai_prices.json")
PROXY_LIST_PATH = os.path.join(CONFIG_DIR, "proxies.txt")
COOKIES_PATH = os.path.join(BASE_DIR, "cookies.txt")

# --- UI Colors (Light Mode) ---
# [DESIGN SYSTEM] Cores centralizadas para Tema Claro.
COLOR_BG = wx.Colour(255, 255, 255)  # White
COLOR_FG = wx.Colour(40, 40, 40)      # Dark Gray
COLOR_HIGHLIGHT = wx.Colour(240, 240, 240) # Light highlight
COLOR_ACCENT = wx.Colour(0, 120, 215)  # Blue accent

