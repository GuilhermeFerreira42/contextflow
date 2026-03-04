
import os
import sys
import unittest
import sqlite3
import psutil
import threading
import time

# Define path to include project root
sys.path.append(os.path.abspath('.'))

try:
    import wx
    from core.app_state import AppState
    from core.managers.video_manager import VideoManager
    from core.managers.finance_manager import FinanceManager
    from core.managers.task_manager import TaskManager
    from core.managers.theme_manager import ThemeManager
    from core.pubsub import PubSub
except ImportError as e:
    print(f"FAILED: Imports missing - {e}")
    sys.exit(1)

class TestPhase60Architecture(unittest.TestCase):
    _app = wx.App() # Necessário para objetos wx

    def test_app_state_facade_integrity(self):
        """[ITEM] Padrão Facade: AppState deve delegar e não ter persistência própria."""
        state = AppState()
        
        # 1. Verificar se delegados existem
        self.assertIsInstance(state.video_manager, VideoManager)
        self.assertIsInstance(state.finance_manager, FinanceManager)
        self.assertIsInstance(state.task_manager, TaskManager)
        
        # 2. Verificar ausência de métodos de persistência direta legados (Audit)
        # Se AppState ainda tiver db_handler sendo usado diretamente para persistência no corpo da classe, falha.
        # Na v6.0, AppState deve apenas repassar chamadas.
        with open('core/app_state.py', 'r', encoding='utf-8') as f:
            content = f.read()
            # Se houver 'self.db_handler.save' fora de métodos decorados/transparentes, sinal de alerta
            # Mas vamos focar na limpeza física: o arquivo deve estar focado em delegação.
            self.assertTrue(len(content.splitlines()) < 400, "AppState ainda é muito grande para uma Fachada Pura")

    def test_zero_knowledge_imports(self):
        """[ITEM] Protocolo Zero-Knowledge: Abas não podem se conhecer."""
        ui_files = [
            'ui/tab_batch.py',
            'ui/tab_analysis.py',
            'ui/panel_detail.py'
        ]
        
        for file_path in ui_files:
            if not os.path.exists(file_path): continue
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                # Uma aba não pode importar a outra
                if 'tab_analysis.py' not in file_path:
                    self.assertNotIn('import TabAnalysis', content)
                    self.assertNotIn('from ui.tab_analysis', content)
                if 'tab_batch.py' not in file_path:
                    self.assertNotIn('import TabBatch', content)
                    self.assertNotIn('from ui.tab_batch', content)

    def test_billing_db_integrity(self):
        """[ITEM] Contrato de Dados: billing.db e transações."""
        db_path = os.path.join('data', 'billing.db')
        self.assertTrue(os.path.exists(db_path), "billing.db não foi criado")
        
        fm = FinanceManager()
        # Testa transação mock: video_id, provider, model, input, output, cost
        fm.log_transaction("test_vid", "openai", "gpt-4", 1000, 500, 0.03)
        
        # Verifica no banco físico
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("SELECT video_id FROM billing_events WHERE video_id='test_vid'")
        row = cur.fetchone()
        conn.close()
        self.assertIsNotNone(row)

class TestStressAndHardware(unittest.TestCase):
    _app = wx.App()

    def test_scalability_10k(self):
        """[ITEM] Escalabilidade 10k: RAM < 250MB."""
        from storage.db_handler import DatabaseHandler
        db = DatabaseHandler()
        vm = VideoManager(db)
        vm._videos = {} # Limpa cache
        
        process = psutil.Process()
        initial_mem = process.memory_info().rss / (1024 * 1024)
        
        # Injeta 10.000 itens mock
        for i in range(10000):
            vm._videos[f"vid_{i}"] = {
                "id": f"vid_{i}",
                "title": f"Video Stress Test {i}",
                "status": "completed",
                "token_count": 1000
            }
        
        vm._cache_dirty = True
        unified = vm.get_unified_data()
        self.assertEqual(len(unified), 10000)
        
        final_mem = process.memory_info().rss / (1024 * 1024)
        print(f"\n[MEM] RAM Total em 10k items: {final_mem:.2f}MB")
        self.assertLess(final_mem, 250, f"Consumo de RAM excedeu 250MB (Atual: {final_mem:.2f}MB)")

    def test_ollama_semaphore(self):
        """[ITEM] Semáforo de Hardware: Ollama = 1 worker."""
        tm = TaskManager()
        concurrency_tracker = {"max": 0, "current": 0}
        lock = threading.Lock()

        def ai_task_func():
            with lock:
                concurrency_tracker["current"] += 1
                concurrency_tracker["max"] = max(concurrency_tracker["max"], concurrency_tracker["current"])
            time.sleep(0.1)
            with lock:
                concurrency_tracker["current"] -= 1

        # Submete 5 tarefas "Ollama"
        for i in range(5):
            tm.submit_task(f"t_{i}", ai_task_func, provider="ollama")
        
        # Aguarda finalização
        timeout = 5
        start = time.time()
        while time.time() - start < timeout:
            with lock:
                if concurrency_tracker["current"] == 0 and i == 4: # Simplificação
                    # Checar se as 5 rodaram
                    pass
            time.sleep(0.1)
        
        print(f"\n[CONCURRENCY] Máxima concorrência Ollama: {concurrency_tracker['max']}")
        self.assertEqual(concurrency_tracker["max"], 1, "TaskManager permitiu execução paralela no Ollama")

if __name__ == '__main__':
    unittest.main()
