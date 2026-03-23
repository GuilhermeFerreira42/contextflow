# contextflow/services/ai_providers/google_provider.py
"""
Stub do Provider Google Gemini.
[FASE 6.1a] Interface preparada. Implementação real na Fase 6.1b.
"""
import logging
from typing import Dict, Any, Optional, List
from services.ai_provider import AIProvider, AIProviderError

logger = logging.getLogger("contextflow.ai.google")


class GoogleProvider(AIProvider):
    """
    Provider Google Gemini — STUB.
    Implementação real será feita na Fase 6.1b.
    """

    def __init__(self, api_key: str = ""):
        self.api_key = api_key

    def summarize(self, transcript: str, prompt: str, model: str,
                  options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        raise AIProviderError(
            "Google Gemini não implementado nesta versão. "
            "Use Ollama como provedor ativo. "
            "Implementação prevista para Fase 6.1b."
        )

    def list_models(self) -> List[Dict[str, Any]]:
        # Retorna lista hardcoded de modelos conhecidos
        return [
            {"name": "gemini-2.0-flash", "context_length": 1_048_576,
             "has_thinking": True, "is_cloud": True},
            {"name": "gemini-1.5-pro", "context_length": 2_097_152,
             "has_thinking": False, "is_cloud": True},
            {"name": "gemini-1.5-flash", "context_length": 1_048_576,
             "has_thinking": False, "is_cloud": True},
        ]

    def get_model_info(self, model_name: str) -> Dict[str, Any]:
        for m in self.list_models():
            if m["name"] == model_name:
                return m
        return {}

    def is_available(self) -> bool:
        return bool(self.api_key)
