# contextflow/core/app_state.py
import threading
import uuid
import wx
import logging
from typing import Dict, Any, List, Callable, Optional
from concurrent.futures import ThreadPoolExecutor
from storage.db_handler import DatabaseHandler
from core.config_manager import ConfigManager

logger = logging.getLogger("contextflow.state")

class AppState:
    """
    Singleton que gerencia o Estado Global da Aplicação.
    
    [THREAD SAFETY] Utiliza RLock internamente para garantir [SSOT]
    em operações concorrentes (Processor Thread vs UI Thread).
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
            
            # [QA4] Cache de Snapshot para Performance 10k
            self._snapshot_cache: List[Dict[str, Any]] = []
            self._cache_dirty = True
            
            # [QA4] Pool de Workers Centralizado para Persistência e Tarefas Leves
            self.executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="CF_CorePool")
            
            self.config = ConfigManager()
            self._cancel_requested = False # [PHASE_5_12] Kill-switch global
            
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
        """
        Dispara callbacks.
        
        [CRÍTICO] Se o callback for para a UI, usamos wx.CallAfter.
        Isso delega a execução para a MainLoop, evitando crash por manipulação de GUI em thread secundária.
        """
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
            # [QA3] Ordenação por added_at desc (Cronologia Real)
            v_list = list(self._videos.values())
            
            def sort_key(x):
                ts = x.get('added_at') or ""
                if len(ts) >= 10 and ts[2] == '/' and ts[5] == '/':
                    return ts[6:10] + ts[3:5] + ts[0:2] + ts[11:]
                return ts
                
            v_list.sort(key=sort_key, reverse=True)
            return v_list

    def get_video(self, video_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            # Retorna cópia para evitar mutação externa acidental
            v = self._videos.get(video_id)
            return dict(v) if v else None
            
    def get_active_downloads(self) -> List[Dict[str, Any]]:
        with self._lock:
            return list(self._active_downloads.values())

    def get_unified_data(self) -> List[Dict[str, Any]]:
        """
        [ATOMIC UNIFICATION & DEDUPLICATION]
        [QA4] Snapshot Caching: Retorna cache se não houver mutações pendentes.
        """
        with self._lock:
            if not self._cache_dirty:
                return self._snapshot_cache
                
            persistent = list(self._videos.values())
            active = self._active_downloads.values()
            
            promoted_uuids = {v.get('uuid') for v in persistent if v.get('uuid')}
            filtered_active = [a for a in active if a.get('uuid') not in promoted_uuids]
            
            unified = filtered_active + persistent
            
            # Ordenação Padrão: added_at decrescente
            def sort_key(x):
                ts = x.get('added_at') or ""
                if len(ts) >= 10 and ts[2] == '/' and ts[5] == '/':
                    return ts[6:10] + ts[3:5] + ts[0:2] + ts[11:]
                return ts
            
            unified.sort(key=sort_key, reverse=True)
            
            # Atualiza Cache
            self._snapshot_cache = unified
            self._cache_dirty = False
            return self._snapshot_cache

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
            self._cache_dirty = True
            
            # If it was an active download (UUID based), maybe we should update/clear it?
            # For now, let's keep it simple. Processor manages active state.
        
        # Persistência via CorePool (Async)
        self.executor.submit(self._persist_video_worker, merged)
        
        self._notify('VIDEO_UPDATED', video_id)

    def _persist_video_worker(self, video_data):
        self.db_handler.add_video_entry(video_data)
        
    def update_video_status(self, video_id: str, status: str, **kwargs):
        """Shortcut helper."""
        update_payload = {'id': video_id, 'status': status}
        update_payload.update(kwargs)
        self.add_or_update_video(update_payload)

    def promote_task_to_video(self, uuid_str: str, video_data: Dict[str, Any]):
        """
        [PROMOÇÃO ATÔMICA]
        Move uma tarefa de 'active_downloads' para 'videos' sob o mesmo lock.
        Isso evita a duplicação visual na grade durante a unificação SSOT.
        """
        video_id = video_data.get('id')
        if not video_id: return

        with self._lock:
            # 1. Adiciona ao dicionário de vídeos persistentes
            existing = self._videos.get(video_id, {})
            merged = {**existing, **video_data}
            self._videos[video_id] = merged
            self._cache_dirty = True
            
            # 2. Remove da lista de tarefas ativas (UUID)
            if uuid_str in self._active_downloads:
                del self._active_downloads[uuid_str]
        
        # Persistência Assíncrona via Pool
        self.executor.submit(self._persist_video_worker, merged)
        
        # Notificação única para evitar refrescos duplicados
        self._notify('VIDEO_PROMOTED', {'video_id': video_id, 'uuid': uuid_str})

    def add_active_task(self, uuid_str: str, data: Dict[str, Any]):
        """Registra uma tarefa temporária (antes de ter ID de vídeo ou enquanto está na fila)."""
        with self._lock:
            self._active_downloads[uuid_str] = data
            self._cache_dirty = True
        self._notify('TASK_ADDED', uuid_str)

    def update_active_task(self, uuid_str: str, updates: Dict[str, Any]):
        with self._lock:
            if uuid_str in self._active_downloads:
                self._active_downloads[uuid_str].update(updates)
                self._cache_dirty = True
                self._notify('TASK_UPDATED', uuid_str)
            else:
                # Se não existe, cria (pode acontecer na inicialização de fila)
                self._active_downloads[uuid_str] = updates
                self._notify('TASK_ADDED', uuid_str)

    def remove_active_task(self, uuid_str: str):
        with self._lock:
            if uuid_str in self._active_downloads:
                del self._active_downloads[uuid_str]
                self._cache_dirty = True
                self._notify('TASK_REMOVED', uuid_str)

    def clear_queued_tasks(self):
        """[QA2 REFINE] Remove todas as tarefas com status 'queued'."""
        with self._lock:
            to_delete = [uid for uid, task in self._active_downloads.items() if task.get('status') == 'queued']
            for uid in to_delete:
                del self._active_downloads[uid]
            if to_delete: self._cache_dirty = True
        
        self._notify('TASKS_CLEARED')

    def delete_videos(self, ids: List[str]):
        """
        Remove itens da memória e do banco de forma imediata.
        [PHASE_5_11] Expurgo total do modo Undo.
        """
        if not ids: return
        self._execute_permanent_delete(ids)

    def _execute_permanent_delete(self, ids: List[str]):
        """Deleção imediata e definitiva."""
        sql_ids = []
        with self._lock:
            for vid in ids:
                target_id = None
                
                # 1. Busca direta por ID real no banco de memória
                if vid in self._videos:
                    target_id = vid
                
                # 2. Busca direta por UUID em tarefas ativas
                elif vid in self._active_downloads:
                    del self._active_downloads[vid]
                
                # 3. Busca por UUID dentro do banco de vídeos (Recuperação de Promoção)
                else:
                    for db_id, data in self._videos.items():
                        if data.get('uuid') == vid:
                            target_id = db_id
                            break
                
                if target_id:
                    del self._videos[target_id]
                    sql_ids.append(target_id)
            
            self._cache_dirty = True
        
        # Persiste deleção no banco via Pool
        if sql_ids:
            self.executor.submit(self._delete_worker, sql_ids)
        
        # Notificação Atômica para Sincronia Global [PHASE_5_11]
        self._notify('VIDEOS_DELETED', ids)

    def _delete_worker(self, video_ids):
        for vid in video_ids:
            self.db_handler.delete_video(vid)
            logger.info(f"Vídeo {vid} removido do banco físico.")

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

    def set_cancel_requested(self, requested: bool):
        with self._lock:
            self._cancel_requested = requested
            logger.info(f"Cancel request set to: {requested}")

    def is_cancel_requested(self) -> bool:
        with self._lock:
            return self._cancel_requested
