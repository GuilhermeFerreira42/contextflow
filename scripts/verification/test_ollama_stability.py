# contextflow/scripts/verification/test_ollama_stability.py
"""
Script de validação para a OPERAÇÃO BISTURI-OLLAMA.
Verifica:
1. TTL do cache de modelos.
2. Comportamento não-bloqueante do discovery.
3. Cache de disponibilidade do provider.
"""
import sys
import os
import time
import threading
import logging
from unittest.mock import MagicMock, patch

# Adiciona a raiz ao sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from core.app_state import AppState
from services.ai_discovery import AIDiscovery
from constants import AI_DISCOVERY_CACHE_TTL_SECONDS, AI_PROVIDER_AVAILABILITY_CACHE_TTL_SECONDS

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger("test.ollama_stability")

def test_discovery_cache_ttl():
    print("\n--- Testando TTL do Cache de Modelos ---")
    discovery = AIDiscovery()
    discovery.invalidate_cache()
    
    # Mock do provider para contar chamadas
    with patch('services.ai_providers.ollama_provider.OllamaProvider.list_models') as mock_list, \
         patch('services.ai_providers.ollama_provider.OllamaProvider.is_available', return_value=True):
        mock_list.return_value = [{"name": "fake-model", "context_length": 4096, "is_cloud": False, "has_thinking": False}]
        
        # 1ª Chamada: Deve gerar HTTP (Cache Miss)
        print("1ª chamada (expectativa: Cache Miss)...")
        discovery.discover_models("ollama")
        assert mock_list.call_count == 1
        
        # 2ª Chamada: Deve ser Cache Hit (TTL válido)
        print("2ª chamada em 1s (expectativa: Cache Hit)...")
        time.sleep(1)
        discovery.discover_models("ollama")
        assert mock_list.call_count == 1
        
        # 3ª Chamada: Forçar refresh
        print("3ª chamada com force_refresh (expectativa: Cache Invalidation)...")
        discovery.discover_models("ollama", force_refresh=True)
        assert mock_list.call_count == 2
        
    print("✅ Sucesso: Cache TTL e Force Refresh funcionando em AIDiscovery.")

def test_app_state_availability_cache():
    print("\n--- Testando Cache de Disponibilidade no AppState ---")
    state = AppState()
    
    with patch('requests.get') as mock_get:
        mock_get.return_value = MagicMock(status_code=200)
        
        # Limpa cache manual para teste
        state._availability_timestamps.clear()
        state._availability_cache.clear()
        
        # 1ª Chamada: Inicia thread de check
        print("1ª chamada (expectativa: Inicia thread)...")
        res1 = state.is_ai_provider_available("ollama")
        # Retorna False imediatamente (primeira vez) mas dispara thread
        time.sleep(0.5) # Dá tempo para a thread rodar
        
        # 2ª Chamada: Deve retornar True do cache
        print("2ª chamada (expectativa: Cache Hit)...")
        res2 = state.is_ai_provider_available("ollama")
        assert res2 is True
        assert mock_get.call_count == 1
        
        # 3ª Chamada: Imediata
        state.is_ai_provider_available("ollama")
        assert mock_get.call_count == 1
        
    print("✅ Sucesso: Cache de disponibilidade funcionando em AppState.")

def test_discovery_pool_pool():
    print("\n--- Testando Pool de Execução de Discovery ---")
    state = AppState()
    
    with patch.object(state.task_manager, 'submit_task') as mock_submit:
        # Discovery Ollama -> deve usar 'ollama'
        state.discover_ai_models("ollama")
        # task_manager.submit_task("ai_discovery", _discover, provider="ollama")
        args, kwargs = mock_submit.call_args
        assert kwargs['provider'] == "ollama"
        
        # Discovery Google -> deve usar 'generic'
        state.discover_ai_models("google")
        args, kwargs = mock_submit.call_args
        assert kwargs['provider'] == "generic"
        
    print("✅ Sucesso: Discovery agora usa pools diferenciadas.")

if __name__ == "__main__":
    try:
        test_discovery_cache_ttl()
        test_app_state_availability_cache()
        test_discovery_pool_pool()
        print("\n🎉 TODOS OS TESTES PASSARAM!")
    except AssertionError as e:
        print(f"\n❌ FALHA NO TESTE: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 ERRO INESPERADO: {e}")
        sys.exit(1)
