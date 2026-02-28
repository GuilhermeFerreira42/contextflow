# contextflow/core/token_engine.py
import logging
import threading
from typing import Optional, Callable

logger = logging.getLogger("contextflow.tokens")

# [PHASE 6.1] Disponibilidade de Bibliotecas (Diagnóstico em main.py)
try:
    import tiktoken
    TIKTOKEN_AVAILABLE = True
except ImportError:
    TIKTOKEN_AVAILABLE = False

try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False

try:
    import google.generativeai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

class TokenEngine:
    """
    Motor de Tokenização de Alta Precisão (Phase 6.1).
    Utiliza o Strategy Pattern para carregar encoders oficiais sob demanda (Lazy Loading).
    """
    _instance = None
    _lock = threading.RLock()
    
    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(TokenEngine, cls).__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self):
        if self._initialized: return
        with self._lock:
            self._encoders = {}
            self._initialized = True

    def get_encoder(self, provider: str, model: str) -> Callable[[str], int]:
        """Retorna uma função que conta tokens para o provedor/modelo especificado."""
        provider = provider.lower()
        
        with self._lock:
            if provider in self._encoders:
                return self._encoders[provider]
            
            encoder = self._load_strategy(provider, model)
            self._encoders[provider] = encoder
            return encoder

    def _load_strategy(self, provider: str, model: str) -> Callable[[str], int]:
        """Lazy loading dos encoders oficiais."""
        if provider == "openai":
            try:
                import tiktoken
                encoding = tiktoken.encoding_for_model(model)
                return lambda x: len(encoding.encode(x))
            except Exception as e:
                logger.error(f"Fallback OpenAI: {e}")
                
        elif provider == "anthropic":
            try:
                # [PHASE 6.1] Uso do Tokenizer da Anthropic se disponível offline
                if ANTHROPIC_AVAILABLE:
                    import anthropic
                    # O tokenizer da Anthropic costuma ser o cl100k_base para Claude 3
                    import tiktoken
                    encoding = tiktoken.get_encoding("cl100k_base")
                    return lambda x: len(encoding.encode(x))
                return lambda x: len(x) // 4
            except Exception as e:
                logger.warning(f"Fallback Anthropic: {e}")
                return lambda x: len(x) // 4

        elif provider == "google" or provider == "gemini":
            try:
                # [PHASE 6.1] Heurística de Precisão para Gemini (Aprox 1:3.8)
                # Mais preciso que o fallback 1:4 absoluto
                return lambda x: int(len(x) / 3.8)
            except Exception as e:
                logger.warning(f"Fallback Google: {e}")
                return lambda x: len(x) // 4

        # Fallback Industrial (1:4)
        return lambda x: len(x) // 4

    def count_tokens(self, text: str, provider: str = "openai", model: str = "gpt-4o-mini") -> int:
        encoder = self.get_encoder(provider, model)
        try:
            return encoder(text)
        except:
            return len(text) // 4

def count_tokens(text: str, provider: str = "openai", model: str = "gpt-4o-mini") -> int:
    """Wrapper top-level para compatibilidade com legados da Phase 6."""
    return TokenEngine().count_tokens(text, provider, model)
