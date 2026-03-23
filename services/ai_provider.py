# contextflow/services/ai_provider.py
"""
Interface abstrata para provedores de IA.
[FASE 6.1a] Todo provedor DEVE implementar esta interface.
"""
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List
import logging

logger = logging.getLogger("contextflow.ai.provider")


class AIProviderError(Exception):
    """
    Exceção base para erros de provedores de IA.
    [GOVERNANÇA] Toda falha de IA DEVE ser encapsulada nesta exceção
    para que o AIExecutor possa capturá-la uniformemente.
    """
    pass


class AIProvider(ABC):
    """
    Interface abstrata (ABC) para provedores de IA.
    Contrato público que todo provider deve implementar.
    """

    @abstractmethod
    def summarize(self, transcript: str, prompt: str, model: str,
                  options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Envia transcrição para o modelo e retorna JSON estruturado.
        
        Args:
            transcript: Texto da transcrição (pode ser truncado pelo executor)
            prompt: Prompt completo montado pelo executor
            model: Nome do modelo a usar
            options: Opções extras (temperature, top_p, num_predict, etc.)
        
        Returns:
            Dict com pelo menos: {"summary": str, "tags": List[str], "language": str}
        
        Raises:
            AIProviderError: Em caso de qualquer falha (rede, parse, timeout)
        """
        pass

    @abstractmethod
    def list_models(self) -> List[Dict[str, Any]]:
        """
        Lista modelos disponíveis no provedor.
        
        Returns:
            Lista de dicts, cada um com pelo menos:
            {"name": str, "context_length": int, "has_thinking": bool, "is_cloud": bool}
        """
        pass

    @abstractmethod
    def get_model_info(self, model_name: str) -> Dict[str, Any]:
        """
        Retorna metadados detalhados de um modelo específico.
        
        Returns:
            Dict com: context_length, has_thinking, is_cloud, family, parameter_size, quantization_level
        """
        pass

    @abstractmethod
    def is_available(self) -> bool:
        """
        Verifica se o provedor está acessível.
        Não deve levantar exceções — retorna False em caso de falha.
        """
        pass
