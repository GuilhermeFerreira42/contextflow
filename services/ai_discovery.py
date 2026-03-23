# contextflow/services/ai_discovery.py
"""
Discovery automático de modelos por provedor.
[FASE 6.1a] Usa HTTP puro — NÃO usa subprocess.
"""
import logging
import threading
from typing import Dict, Any, List, Optional

from core.config_manager import ConfigManager
from services.ai_providers.ollama_provider import OllamaProvider
from services.ai_providers.google_provider import GoogleProvider
from constants import AI_DEFAULT_CONTEXT_FALLBACK

logger = logging.getLogger("contextflow.ai.discovery")


class AIDiscovery:
    """
    Serviço de descoberta de modelos de IA.
    
    Responsabilidades:
    - Listar modelos disponíveis por provedor
    - Fornecer metadados (context_length, capabilities) ao AIExecutor
    - Cache em memória com invalidação manual
    """

    def __init__(self):
        self.config = ConfigManager()
        self._cache: Dict[str, List[Dict[str, Any]]] = {}
        self._lock = threading.Lock()

    def discover_models(self, provider: str = None) -> List[Dict[str, Any]]:
        """
        Descobre modelos para o provedor especificado.
        Se provider=None, usa active_provider do ConfigManager.
        Thread-safe via lock.
        """
        if provider is None:
            provider = self.config.get("orchestration", "active_provider", "ollama")

        with self._lock:
            if provider == "ollama":
                models = self._discover_ollama()
            elif provider == "google":
                models = self._discover_google()
            else:
                logger.warning(f"Provider '{provider}' não suportado para discovery.")
                models = []

            self._cache[provider] = models
            return models

    def get_cached_models(self, provider: str = None) -> List[Dict[str, Any]]:
        """Retorna modelos do cache sem fazer nova chamada HTTP."""
        if provider is None:
            provider = self.config.get("orchestration", "active_provider", "ollama")
        return self._cache.get(provider, [])

    def get_model_context_limit(self, model_name: str, provider: str = "ollama") -> int:
        """
        Retorna o context_length do modelo.
        Usado pelo AIExecutor para decidir truncamento vs. map-reduce.
        
        Ordem de busca:
        1. Cache em memória
        2. Chamada direta ao provider
        3. Fallback conservador (AI_DEFAULT_CONTEXT_FALLBACK)
        """
        # 1. Busca no cache
        cached = self._cache.get(provider, [])
        for model in cached:
            if model["name"] == model_name:
                ctx = model.get("context_length", 0)
                if ctx > 0:
                    return ctx

        # 2. Busca direta
        if provider == "ollama":
            try:
                endpoint = self.config.get("ollama", "endpoint", "http://localhost:11434")
                p = OllamaProvider(endpoint=endpoint)
                info = p.get_model_info(model_name)
                ctx = info.get("context_length", 0)
                if ctx > 0:
                    return ctx
            except Exception as e:
                logger.warning(f"Falha ao buscar context_length para {model_name}: {e}")

        elif provider == "google":
            p = GoogleProvider()
            info = p.get_model_info(model_name)
            ctx = info.get("context_length", 0)
            if ctx > 0:
                return ctx

        # 3. Fallback
        logger.info(
            f"Context limit não encontrado para {model_name}. "
            f"Usando fallback: {AI_DEFAULT_CONTEXT_FALLBACK}"
        )
        return AI_DEFAULT_CONTEXT_FALLBACK

    def invalidate_cache(self):
        """Limpa todo o cache para forçar re-discovery."""
        with self._lock:
            self._cache.clear()
            logger.info("AIDiscovery: Cache invalidado.")

    # ─── DISCOVERY POR PROVEDOR ───────────────────────────────

    def _discover_ollama(self) -> List[Dict[str, Any]]:
        """Discovery via HTTP (/api/tags + /api/show)."""
        endpoint = self.config.get("ollama", "endpoint", "http://localhost:11434")
        provider = OllamaProvider(endpoint=endpoint)

        if not provider.is_available():
            logger.warning(f"Ollama não disponível em {endpoint}")
            return []

        return provider.list_models()

    def _discover_google(self) -> List[Dict[str, Any]]:
        """Discovery para Google Gemini (stub - lista hardcoded)."""
        api_key = self.config.get("api_keys", "google", "")
        provider = GoogleProvider(api_key=api_key)
        return provider.list_models()
