# contextflow/core/adapters/base_adapter.py
from typing import Generator, Dict, Any, Optional
from abc import ABC, abstractmethod

class BaseAIAdapter(ABC):
    """
    Interface abstrata para adaptadores de IA no ContextFlow.
    Garante que todos os provedores sigam o contrato de streaming e governança.
    """
    
    @abstractmethod
    def generate_summary_stream(self, transcript: str, prompt_template: str, config: Dict[str, Any]) -> Generator[str, None, Dict[str, Any]]:
        """
        Gera um resumo em stream.
        Yields: Chunks de texto (str).
        Returns: Dict com metadados finais (tokens usados, status, etc.).
        """
        pass

    @abstractmethod
    def count_tokens(self, text: str) -> int:
        """
        Conta tokens de forma específica para o modelo/provedor.
        """
        pass

    @abstractmethod
    def validate_config(self, config: Dict[str, Any]) -> bool:
        """
        Verifica se as chaves e modelos necessários estão presentes.
        """
        pass
