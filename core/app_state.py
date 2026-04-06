# contextflow/core/app_state.py
import threading
import wx
import logging
from typing import Dict, Any, List, Callable, Optional

from storage.db_handler import DatabaseHandler
from core.config_manager import ConfigManager
from core.managers.video_manager import VideoManager
from core.managers.finance_manager import FinanceManager
from core.managers.task_manager import TaskManager
from core.managers.theme_manager import ThemeManager
from constants import AI_PROVIDER_AVAILABILITY_CACHE_TTL_SECONDS
import time

logger = logging.getLogger("contextflow.state")

class AppState:
    """
    [FACHADA DE DELEGAÇÃO - FASE 6.0]
    Singleton que centraliza o acesso aos gerentes especializados.
    Mantém a retrocompatibilidade com as abas da UI (Zero-Knowledge).
    """
    _instance = None
    _lock = threading.RLock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(AppState, cls).__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self):
        if self._initialized: return
            
        with self._lock:
            self._initialized = True
            
            # Infraestrutura de Base
            self.db_handler = DatabaseHandler()
            self.config = ConfigManager()
            
            # Gerentes Especializados (Fragmentação do Monolito)
            self.video_manager = VideoManager(self.db_handler)
            self.finance_manager = FinanceManager()
            self.task_manager = TaskManager()
            self.theme_manager = ThemeManager()
            
            # [BISTURI-OLLAMA] Cache de Disponibilidade de Provedores
            self._availability_cache: Dict[str, bool] = {}
            self._availability_timestamps: Dict[str, float] = {}
            
            # PubSub Interno (Observers)
            self._observers: List[Callable[[str, Any], None]] = []
            
            logger.info("AppState: Monolito fragmentado em Gerentes Especializados (Fase 6.0).")

    # --- Observer Pattern (Mantido para Sincronia de UI) ---

    def register_observer(self, callback: Callable[[str, Any], None]):
        with self._lock:
            if callback not in self._observers:
                self._observers.append(callback)

    def unregister_observer(self, callback: Callable[[str, Any], None]):
        with self._lock:
            if callback in self._observers:
                self._observers.remove(callback)

    def _notify(self, event_type: str, data: Any = None):
        with self._lock:
            observers_copy = list(self._observers)
        for obs in observers_copy:
            try:
                if wx.GetApp():
                    wx.CallAfter(obs, event_type, data)
                else:
                    obs(event_type, data)
            except Exception as e:
                logger.error(f"AppState: Erro ao notificar observer {obs}: {e}")

    # --- Delegation: Video Management ---

    def get_all_videos(self) -> List[Dict[str, Any]]:
        return self.video_manager.get_all_videos()

    def get_video(self, video_id: str) -> Optional[Dict[str, Any]]:
        return self.video_manager.get_video(video_id)
            
    def get_active_downloads(self) -> List[Dict[str, Any]]:
        return list(self.video_manager._active_tasks.values())

    def get_unified_data(self) -> List[Dict[str, Any]]:
        return self.video_manager.get_unified_data()

    def add_or_update_video(self, video_data: Dict[str, Any]):
        merged = self.video_manager.add_or_update_video(video_data)
        if merged:
            # Persistência Assíncrona via TaskManager (Executor Genérico)
            self.task_manager.submit_task(f"persist_{merged.get('id')}", 
                                          self.db_handler.add_video_entry, merged)
            self._notify('VIDEO_UPDATED', merged.get('id'))

    def update_video_status(self, video_id: str, status: str, **kwargs):
        update_payload = {'id': video_id, 'status': status}
        update_payload.update(kwargs)
        self.add_or_update_video(update_payload)

    def promote_task_to_video(self, uuid_str: str, video_data: Dict[str, Any]):
        merged = self.video_manager.promote_task_to_video(uuid_str, video_data)
        if merged:
            self.task_manager.submit_task(f"persist_{merged.get('id')}", 
                                          self.db_handler.add_video_entry, merged)
            self._notify('VIDEO_PROMOTED', {'video_id': merged.get('id'), 'uuid': uuid_str})

    def add_active_task(self, uuid_str: str, data: Dict[str, Any]):
        self.video_manager.add_active_task(uuid_str, data)
        self._notify('TASK_ADDED', uuid_str)

    def update_active_task(self, uuid_str: str, updates: Dict[str, Any]):
        if self.video_manager.update_active_task(uuid_str, updates):
            self._notify('TASK_UPDATED', uuid_str)
        else:
            # Se não existe, cria (como no original)
            if not self.task_manager.is_cancelled():
                self.video_manager.add_active_task(uuid_str, updates)
                self._notify('TASK_ADDED', uuid_str)

    def remove_active_task(self, uuid_str: str):
        self.video_manager.remove_active_task(uuid_str)
        self._notify('TASK_REMOVED', uuid_str)

    def purge_active_tasks(self):
        self.video_manager.clear_non_completed()
        logger.info("AppState: Purge complete via VideoManager.")
        self._notify('TASKS_CLEARED')

    def delete_videos(self, ids: List[str]):
        sql_ids = self.video_manager.delete_videos(ids)
        if sql_ids:
            for vid in sql_ids:
                self.task_manager.submit_task(f"delete_{vid}", self.db_handler.delete_video, vid)
        self._notify('VIDEOS_DELETED', ids)

    def delete_playlist(self, playlist_id: str):
        videos = self.get_all_videos()
        ids_to_remove = [v['id'] for v in videos if v.get('playlist_id') == playlist_id]
        if ids_to_remove:
            self.delete_videos(ids_to_remove)
            self._notify('PLAYLIST_DELETED', playlist_id)

    def delete_orphans(self) -> List[str]:
        videos = self.get_all_videos()
        ids_to_remove = [v['id'] for v in videos if not v.get('playlist_id')]
        if ids_to_remove:
            self.delete_videos(ids_to_remove)
        return ids_to_remove

    # --- Delegation: Task & Kill-Switch ---

    def set_cancel_requested(self, requested: bool):
        if requested:
            self.task_manager.atomic_kill_switch()
        # Nota: TaskManager.is_cancelled() agora é a SSoT para cancelamento

    def is_cancel_requested(self) -> bool:
        return self.task_manager.is_cancelled()

    # ─── Delegation: AI Summary (FASE 6.1a) ───────────────────

    def get_video_tags(self, video_id: str) -> list:
        """Retorna tags do vídeo como lista Python."""
        return self.video_manager.get_video_tags(video_id)

    def get_summary_status(self, video_id: str) -> str:
        """Retorna status de resumo do vídeo."""
        return self.video_manager.get_summary_status(video_id)

    def get_videos_pending_summary(self) -> list:
        """Retorna vídeos elegíveis para resumo."""
        return self.video_manager.get_videos_pending_summary()

    def request_summary(self, video_id: str):
        """
        Submete pedido de resumo ao TaskManager.
        [THREAD SAFETY] O executor roda na pool de IA (max_workers=1 para Ollama).
        """
        from services.ai_executor import AIExecutor
        executor = AIExecutor(self)

        provider = self.config.get("orchestration", "active_provider", "ollama")
        self.task_manager.submit_task(
            f"summary_{video_id}",
            executor.execute_summary,
            video_id,
            provider=provider
        )

    def request_batch_summary(self, video_ids: list):
        """
        Submete múltiplos pedidos de resumo.
        Cada vídeo é enfileirado como tarefa separada.
        O TaskManager controla a concorrência (1 para Ollama, N para cloud).
        """
        for vid in video_ids:
            self.request_summary(vid)

    def discover_ai_models(self, provider: str = None, callback=None, force_refresh: bool = False):
        """
        Descobre modelos de IA disponíveis em background.
        [BISTURI-OLLAMA] Corrigido para carregar na pool correta.
        O callback recebe a lista de modelos e DEVE usar wx.CallAfter.

        Args:
            provider: Nome do provedor (None = active_provider)
            callback: Callable[[List[Dict]], None] chamado com resultado
            force_refresh: Força re-discovery ignorando cache
        """
        def _discover():
            from services.ai_discovery import AIDiscovery
            discovery = AIDiscovery()
            models = discovery.discover_models(provider, force_refresh=force_refresh)
            if callback:
                # [FIX FASE 6.1b] Sempre garante wx.CallAfter no callback
                if wx.GetApp():
                    wx.CallAfter(callback, models)
                else:
                    callback(models)

        # [BISTURI-OLLAMA] Usa pool 'ollama' para discovery local (max_workers=1)
        # para evitar concorrência destrutiva no servidor local.
        exec_provider = provider if provider == "ollama" else "generic"
        if exec_provider is None: # Se provider for None, pega o ativo
            active = self.config.get("orchestration", "active_provider", "ollama")
            exec_provider = "ollama" if active == "ollama" else "generic"

        self.task_manager.submit_task(
            "ai_discovery",
            _discover,
            provider=exec_provider
        )

    def get_ai_model_context(self, model_name: str, provider: str = "ollama") -> int:
        """Retorna context_length do modelo."""
        from services.ai_discovery import AIDiscovery
        return AIDiscovery().get_model_context_limit(model_name, provider)

    def is_ai_provider_available(self, provider: str = None) -> bool:
        """
        Verifica se o provedor de IA está acessível.
        [BISTURI-OLLAMA] Implementa Cache TTL para evitar bloqueio da Main Thread.
        """
        if provider is None:
            provider = self.config.get("orchestration", "active_provider", "ollama")
        
        # 1. Verifica Cache
        now = time.time()
        with self._lock:
            ts = self._availability_timestamps.get(provider, 0)
            if now - ts < AI_PROVIDER_AVAILABILITY_CACHE_TTL_SECONDS:
                return self._availability_cache.get(provider, False)

        # 2. Se expirado, faz a verificação (ou dispara background)
        # Para evitar o bloqueio inicial de 3s do requests.get na Main Thread,
        # aqui usamos um truque: se for a primeira vez ou tiver expirado, 
        # disparamos a verificação em uma thread rápida e retornamos o anterior.
        
        def _check():
            res = False
            if provider == "ollama":
                import requests
                endpoint = self.config.get("ollama", "endpoint", "http://localhost:11434")
                try:
                    r = requests.get(f"{endpoint}/", timeout=2) # Timeout menor
                    res = (r.status_code == 200)
                except Exception:
                    res = False
            elif provider == "google":
                # Check simplificado para Google Gemini
                from services.ai_providers.google_provider import GoogleProvider
                res = GoogleProvider().is_available()
            
            with self._lock:
                self._availability_cache[provider] = res
                self._availability_timestamps[provider] = time.time()
                logger.debug(f"AppState: IA Provider {provider} availability check: {res}")

        # Dispara thread one-off se não houver uma rodando (opcional, aqui simplificado)
        threading.Thread(target=_check, daemon=True).start()
        
        return self._availability_cache.get(provider, False)
