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
