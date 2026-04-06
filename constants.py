
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

# --- AI Summary Configuration (FASE 6.1a) ---
CONTEXTFLOW_JSON_SCHEMA = {
    "summary": "Resumo narrativo completo do conteúdo...",
    "tags": ["tag1", "tag2", "tag3"],
    "language": "pt-BR"
}

SUMMARY_SYSTEM_PROMPT = """Você é um assistente especializado em análise de conteúdo de vídeo.
Sua tarefa é analisar a transcrição abaixo e gerar um resumo estruturado em JSON.

## REGRAS OBRIGATÓRIAS:
1. Responda APENAS com JSON válido, sem texto antes ou depois
2. Não use markdown (sem ```json)
3. O campo "summary" deve ter entre 200-500 palavras
4. O campo "tags" deve ter entre 3-8 tags relevantes em português
5. Idioma do resumo: português do Brasil (pt-BR)
6. As tags devem ser substantivos ou expressões curtas que descrevam os temas centrais

## SCHEMA DE SAÍDA:
{schema}

## TRANSCRIÇÃO DO VÍDEO:
{transcript}"""

SUMMARY_MAP_PROMPT = """Você é um assistente especializado em análise de conteúdo.
Extraia os pontos-chave do trecho abaixo. Responda APENAS com JSON válido.

## SCHEMA:
{{"key_points": ["ponto 1", "ponto 2", ...], "partial_tags": ["tag1", "tag2"]}}

## TRECHO:
{chunk}"""

SUMMARY_REDUCE_PROMPT = """Você é um assistente especializado em síntese de conteúdo.
Abaixo estão extrações parciais de um vídeo longo. Consolide tudo em um resumo final.
Responda APENAS com JSON válido.

## SCHEMA:
{schema}

## EXTRAÇÕES PARCIAIS:
{partial_summaries}"""

# Limites de segurança para IA
AI_DEFAULT_CONTEXT_FALLBACK = 4096
AI_CONTEXT_USAGE_RATIO = 0.75  # Usa no máximo 75% do contexto do modelo
AI_MAP_CHUNK_RATIO = 0.60      # Cada chunk usa 60% do contexto (reserva para prompt+resposta)
AI_DEFAULT_TIMEOUT = 600       # 10 minutos
AI_DEFAULT_TEMPERATURE = 0.7
AI_DEFAULT_TOP_P = 0.9
AI_DEFAULT_NUM_PREDICT = 2048

# --- AI Discovery & Availability Cache [BISTURI-OLLAMA] ---
AI_DISCOVERY_CACHE_TTL_SECONDS = 60            # 1 minuto
AI_PROVIDER_AVAILABILITY_CACHE_TTL_SECONDS = 30 # 30 segundos

