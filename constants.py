
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

# --- UI Colors (Dark Theme) ---
# [DESIGN SYSTEM] Cores centralizadas para garantir consistência visual.
# Alterar COLOR_ACCENT muda a identidade visual (botões, focos) globalmente.
COLOR_BG = wx.Colour(30, 30, 30)
COLOR_FG = wx.Colour(220, 220, 220)
COLOR_HIGHLIGHT = wx.Colour(70, 70, 70)
COLOR_ACCENT = wx.Colour(0, 120, 215)  # Blue accent

