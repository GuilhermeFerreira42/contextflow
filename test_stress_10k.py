# test_stress_10k.py
import time
import os
import sys
from core.app_state import AppState

def test_stress():
    print("Iniciando Teste de Estresse 10k...")
    state = AppState()
    
    # Limpa estado para teste puro
    with state._lock:
        state._videos.clear()
        state._active_downloads.clear()
        state._cache_dirty = True
        
    print("Gerando 10.000 itens mock...")
    start_gen = time.perf_counter()
    for i in range(10000):
        vid = f"mock_vid_{i}"
        state._videos[vid] = {
            'id': vid,
            'title': f"Vídeo de Teste de Performance #{i}",
            'url': f"https://youtube.com/watch?v={i}",
            'added_at': "15/02/2026 12:00:00",
            'status': 'completed',
            'token_count': i * 100
        }
    state._cache_dirty = True
    end_gen = time.perf_counter()
    print(f"Geração concluída em {end_gen - start_gen:.4f}s")
    
    print("\nExecutando get_unified_data (Sorteio + Unificação)...")
    
    # Caso 1: Cache Dirty (Primeira vez)
    t1 = time.perf_counter()
    data1 = state.get_unified_data()
    t2 = time.perf_counter()
    print(f"Primeira carga (Dirty): {t2 - t1:.4f}s")
    
    # Caso 2: Cache Hit (Segunda vez)
    t3 = time.perf_counter()
    data2 = state.get_unified_data()
    t4 = time.perf_counter()
    print(f"Segunda carga (Cache Hit): {t4 - t3:.6f}s")
    
    # Validação
    if len(data1) == 10000 and (t4 - t3) < 0.001:
        print("\n✅ RESULTADO: SUCESSO")
        print(f"Velocidade do Cache: {((t2-t1)/(t4-t3)):.0f}x mais rápido")
    else:
        print("\n❌ RESULTADO: FALHA")

if __name__ == "__main__":
    test_stress()
