# contextflow/core/provider_factory.py
from typing import Dict, Any, Optional
from core.adapters.base_adapter import BaseAIAdapter
from core.adapters.openai_adapter import OpenAIAdapter
from core.adapters.gemini_adapter import GeminiAdapter
from core.adapters.ollama_adapter import OllamaAdapter

class ProviderFactory:
    """
    Factory para instanciar adaptadores de provedores de IA.
    [Fase 6] Centraliza o desacoplamento de provedores.
    """
    
    _adapters = {
        "openai": OpenAIAdapter,
        "gemini": GeminiAdapter,
        "ollama": OllamaAdapter,
        # Anthropic e GROQ podem ser adicionados aqui seguindo o mesmo padrão
    }

    @classmethod
    def get_adapter(cls, provider_name: str) -> BaseAIAdapter:
        adapter_class = cls._adapters.get(provider_name.lower())
        if not adapter_class:
            raise ValueError(f"Provedor IA '{provider_name}' não suportado ou não implementado.")
        
        return adapter_class()

    @classmethod
    def list_supported_providers(cls):
        return list(cls._adapters.keys())
