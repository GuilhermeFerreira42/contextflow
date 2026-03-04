# contextflow/core/managers/task_manager.py
import threading
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, Any, Callable, Optional

logger = logging.getLogger("contextflow.task")

class TaskManager:
    """
    Orquestrador de threads com suporte a Kill-Switch e Semáforo de Hardware.
    Garante que tarefas locais (Ollama) não sobrecarreguem o sistema (max_workers=1).
    """
    def __init__(self):
        # Pool genérico para downloads e tarefas leves
        self._generic_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="CF_Generic")
        # Pool restrito para IA Local (Ollama) - MANDATO FASE 6
        self._ai_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="CF_AILocal")
        
        self._active_tasks = {} # task_id -> future
        self._kill_event = threading.Event()
        self._lock = threading.Lock()

    def submit_task(self, task_id: str, func: Callable, *args, provider: str = "generic", **kwargs):
        """Submete uma tarefa para o executor apropriado."""
        with self._lock:
            if self._kill_event.is_set():
                logger.warning(f"TaskManager: Tentativa de submeter tarefa {task_id} durante Kill-Switch.")
                return False

            executor = self._ai_executor if provider.lower() == "ollama" else self._generic_executor
            future = executor.submit(self._wrap_task, task_id, func, *args, **kwargs)
            self._active_tasks[task_id] = future
            return True

    def _wrap_task(self, task_id: str, func: Callable, *args, **kwargs):
        try:
            if not self._kill_event.is_set():
                return func(*args, **kwargs)
        except Exception as e:
            logger.error(f"TaskManager: Erro na tarefa {task_id}: {e}")
            raise
        finally:
            with self._lock:
                self._active_tasks.pop(task_id, None)

    def atomic_kill_switch(self):
        """Interrompe todas as operações e reinicia os executores."""
        logger.info("TaskManager: DISPARANDO KILL-SWITCH ATÔMICO.")
        with self._lock:
            self._kill_event.set()
            
            # Cancela futures pendentes
            for task_id, future in self._active_tasks.items():
                future.cancel()
            self._active_tasks.clear()
            
            # Shutdown imediato
            self._generic_executor.shutdown(wait=False, cancel_futures=True)
            self._ai_executor.shutdown(wait=False, cancel_futures=True)
            
            # Reset
            self._kill_event.clear()
            self._generic_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="CF_Generic")
            self._ai_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="CF_AILocal")
            logger.info("TaskManager: Kill-switch resetado. Executores reiniciados.")

    def is_cancelled(self) -> bool:
        return self._kill_event.is_set()
