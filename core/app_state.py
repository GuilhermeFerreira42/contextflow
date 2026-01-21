# contextflow/core/app_state.py
import threading
import uuid
import wx
import logging
from typing import Dict, Any, List, Callable, Optional
from storage.db_handler import DatabaseHandler

logger = logging.getLogger("contextflow.state")

class AppState:
    _instance = None
    _lock = threading.RLock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(AppState, cls).__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self):
        if self._initialized:
            return
            
        with self._lock:
            self._initialized = True
            self.db_handler = DatabaseHandler()
            
            # State Storage
            # _videos: Dict mapping video_id (str) -> dict (full metadata)
            self._videos: Dict[str, Dict[str, Any]] = {} 
            
            # _active_downloads: Dict mapping UUID -> dict (temp task data)
            # Used for items currently in queue/processing before they have a real ID or final state
            # Or as a way to track progress of specific operations.
            self._active_downloads: Dict[str, Dict[str, Any]] = {}
            
            # Observers: List of callbacks (event_type, data)
            self._observers: List[Callable[[str, Any], None]] = []
            
            # Load initial state
            self._load_from_db()

    def _load_from_db(self):
        """Loads all videos from DB into memory."""
        try:
            db_videos = self.db_handler.get_all_videos()
            with self._lock:
                self._videos = {v['id']: dict(v) for v in db_videos}
            logger.info(f"AppState loaded {len(self._videos)} videos from DB.")
        except Exception as e:
            logger.error(f"Failed to load state from DB: {e}")

    # --- Observer Pattern ---

    def register_observer(self, callback: Callable[[str, Any], None]):
        with self._lock:
            if callback not in self._observers:
                self._observers.append(callback)

    def unregister_observer(self, callback: Callable[[str, Any], None]):
        with self._lock:
            if callback in self._observers:
                self._observers.remove(callback)

    def _notify(self, event_type: str, data: Any = None):
        """Dispara callbacks na Main Thread via wx.CallAfter para segurança da UI."""
        # Snapshot dos observers para evitar problemas de concorrência se a lista mudar durante iteração
        with self._lock:
            observers_copy = list(self._observers)
            
        for obs in observers_copy:
            try:
                # O observer deve estar preparado para receber CallAfter se for UI
                # Mas como AppState pode ser chamado de thread, garantimos o CallAfter aqui?
                # Se o observer for lógia pura, callafter pode atrapalhar?
                # Assumimos que a maioria dos observers são UI.
                # Se não for wx.App running, chamamos direto (ex: testes).
                if wx.GetApp():
                    wx.CallAfter(obs, event_type, data)
                else:
                    obs(event_type, data)
            except Exception as e:
                logger.error(f"Error notifying observer {obs}: {e}")

    # --- State Management ---

    def get_all_videos(self) -> List[Dict[str, Any]]:
        """Returns a list of all videos (copy of values)."""
        with self._lock:
            # Sort by created_at desc (default view)
            # Precisamos lidar com None
            v_list = list(self._videos.values())
            v_list.sort(key=lambda x: x.get('created_at') or "", reverse=True)
            return v_list

    def get_video(self, video_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            # Retorna cópia para evitar mutação externa acidental
            v = self._videos.get(video_id)
            return dict(v) if v else None
            
    def get_active_downloads(self) -> List[Dict[str, Any]]:
        with self._lock:
            return list(self._active_downloads.values())

    # --- Mutations (Async to DB, Sync to Memory) ---

    def add_or_update_video(self, video_data: Dict[str, Any]):
        """Central method to add/update video. Persists and notifies."""
        video_id = video_data.get('id')
        if not video_id: return

        with self._lock:
            # Merge with existing if present to preserve fields not passed
            existing = self._videos.get(video_id, {})
            merged = {**existing, **video_data}
            
            self._videos[video_id] = merged
            
            # If it was an active download (UUID based), maybe we should update/clear it?
            # For now, let's keep it simple. Processor manages active state.
        
        # Persist (Async ideally, but sync is safer for consistency for now, db_handler is fast sqlite)
        # To make it "async" without blocking UI, we could use a thread, but sqlite writes are fast.
        # Let's run in a separate thread to strictly adhere to "No blocking UI".
        threading.Thread(target=self._persist_video_worker, args=(merged,)).start()
        
        self._notify('VIDEO_UPDATED', video_id)

    def _persist_video_worker(self, video_data):
        self.db_handler.add_video_entry(video_data)
        
    def update_video_status(self, video_id: str, status: str, **kwargs):
        """Shortcut helper."""
        update_payload = {'id': video_id, 'status': status}
        update_payload.update(kwargs)
        self.add_or_update_video(update_payload)

    def add_active_task(self, uuid_str: str, data: Dict[str, Any]):
        """Registra uma tarefa temporária (antes de ter ID de vídeo ou enquanto está na fila)."""
        with self._lock:
            self._active_downloads[uuid_str] = data
        self._notify('TASK_ADDED', uuid_str)

    def update_active_task(self, uuid_str: str, updates: Dict[str, Any]):
        with self._lock:
            if uuid_str in self._active_downloads:
                self._active_downloads[uuid_str].update(updates)
                self._notify('TASK_UPDATED', uuid_str)
            else:
                # Se não existe, cria (pode acontecer na inicialização de fila)
                self._active_downloads[uuid_str] = updates
                self._notify('TASK_ADDED', uuid_str)

    def remove_active_task(self, uuid_str: str):
        with self._lock:
            if uuid_str in self._active_downloads:
                del self._active_downloads[uuid_str]
                self._notify('TASK_REMOVED', uuid_str)

    def delete_videos(self, video_ids: List[str]):
        """Remove videos from memory and DB."""
        with self._lock:
            for vid in video_ids:
                if vid in self._videos:
                    del self._videos[vid]
        
        # Persist Deletion
        threading.Thread(target=self._delete_worker, args=(video_ids,)).start()
        
        self._notify('VIDEOS_DELETED', video_ids)

    def _delete_worker(self, video_ids):
        for vid in video_ids:
            self.db_handler.delete_video(vid)

    def delete_playlist(self, playlist_id: str):
        # Find all videos with playlist_id
        ids_to_remove = []
        with self._lock:
            for vid, data in self._videos.items():
                if data.get('playlist_id') == playlist_id:
                    ids_to_remove.append(vid)
        
        if ids_to_remove:
            self.delete_videos(ids_to_remove)
            # Also notify playlist deletion specifically if UI relies on it
            self._notify('PLAYLIST_DELETED', playlist_id)

    def delete_orphans(self) -> List[str]:
        ids_to_remove = []
        with self._lock:
            for vid, data in self._videos.items():
                pid = data.get('playlist_id')
                if not pid:
                     ids_to_remove.append(vid)
        
        if ids_to_remove:
            self.delete_videos(ids_to_remove)
            
        return ids_to_remove
