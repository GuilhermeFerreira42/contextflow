# contextflow/core/managers/video_manager.py
import threading
import logging
from typing import Dict, Any, List, Optional
from storage.db_handler import DatabaseHandler

logger = logging.getLogger("contextflow.video")

class VideoManager:
    """
    Responsável exclusivo por CRUD de vídeos, metadados e cache de memória.
    Isola a lógica de dados do estado global (AppState).
    """
    def __init__(self, db_handler: DatabaseHandler):
        self.db_handler = db_handler
        self._lock = threading.RLock()
        
        # In-memory storage
        self._videos: Dict[str, Dict[str, Any]] = {}
        self._active_tasks: Dict[str, Dict[str, Any]] = {}
        
        # Cache de Snapshot para Performance 10k
        self._snapshot_cache: List[Dict[str, Any]] = []
        self._cache_dirty = True
        
        self._load_from_db()

    def _load_from_db(self):
        try:
            db_videos = self.db_handler.get_all_videos()
            with self._lock:
                self._videos = {v['id']: dict(v) for v in db_videos}
                self._cache_dirty = True
            logger.info(f"VideoManager: Carregados {len(self._videos)} vídeos do banco.")
        except Exception as e:
            logger.error(f"VideoManager: Falha ao carregar DB: {e}")

    def get_all_videos(self) -> List[Dict[str, Any]]:
        with self._lock:
            v_list = list(self._videos.values())
            self._sort_videos(v_list)
            return v_list

    def get_video(self, video_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            v = self._videos.get(video_id)
            return dict(v) if v else None

    def add_or_update_video(self, video_data: Dict[str, Any]):
        video_id = video_data.get('id')
        if not video_id: return
        with self._lock:
            existing = self._videos.get(video_id, {})
            merged = {**existing, **video_data}
            self._videos[video_id] = merged
            self._cache_dirty = True
            return merged

    def delete_videos(self, ids: List[str]) -> List[str]:
        sql_ids = []
        with self._lock:
            for vid in ids:
                if vid in self._videos:
                    sql_ids.append(vid)
                    del self._videos[vid]
                elif vid in self._active_tasks:
                    del self._active_tasks[vid]
                else:
                    # Busca por UUID
                    for db_id, data in self._videos.items():
                        if data.get('uuid') == vid:
                            sql_ids.append(db_id)
                            del self._videos[db_id]
                            break
            self._cache_dirty = True
        return sql_ids

    def get_unified_data(self) -> List[Dict[str, Any]]:
        with self._lock:
            if not self._cache_dirty:
                return self._snapshot_cache
                
            persistent = list(self._videos.values())
            active = list(self._active_tasks.values())
            
            promoted_uuids = {v.get('uuid') for v in persistent if v.get('uuid')}
            filtered_active = [a for a in active if a.get('uuid') not in promoted_uuids]
            
            unified = filtered_active + persistent
            self._sort_videos(unified)
            
            self._snapshot_cache = unified
            self._cache_dirty = False
            return self._snapshot_cache

    def _sort_videos(self, v_list: List[Dict[str, Any]]):
        def sort_key(x):
            ts = x.get('added_at') or ""
            if len(ts) >= 10 and ts[2] == '/' and ts[5] == '/':
                return ts[6:10] + ts[3:5] + ts[0:2] + ts[11:]
            return ts
        v_list.sort(key=sort_key, reverse=True)

    # Métodos para Tarefas Ativas (Temporary Tasks)
    def add_active_task(self, uuid_str: str, data: Dict[str, Any]):
        with self._lock:
            self._active_tasks[uuid_str] = data
            self._cache_dirty = True

    def update_active_task(self, uuid_str: str, updates: Dict[str, Any]):
        with self._lock:
            if uuid_str in self._active_tasks:
                self._active_tasks[uuid_str].update(updates)
                self._cache_dirty = True
                return True
        return False

    def remove_active_task(self, uuid_str: str):
        with self._lock:
            if uuid_str in self._active_tasks:
                del self._active_tasks[uuid_str]
                self._cache_dirty = True

    def promote_task_to_video(self, uuid_str: str, video_data: Dict[str, Any]):
        video_id = video_data.get('id')
        if not video_id: return None
        with self._lock:
            existing = self._videos.get(video_id, {})
            merged = {**existing, **video_data}
            self._videos[video_id] = merged
            if uuid_str in self._active_tasks:
                del self._active_tasks[uuid_str]
            self._cache_dirty = True
            return merged

    def clear_non_completed(self):
        with self._lock:
            self._active_tasks.clear()
            to_remove = [vid for vid, data in self._videos.items() if data.get('status') != 'completed']
            for vid in to_remove:
                del self._videos[vid]
            self._cache_dirty = True

    # ─── TAGS & SUMMARY (FASE 6.1a) ─────────────────────────

    def get_video_tags(self, video_id: str) -> list:
        """Retorna tags como lista Python (parse do JSON string)."""
        import json
        video = self.get_video(video_id)
        if video:
            tags_str = video.get("tags", "[]")
            try:
                if isinstance(tags_str, str):
                    return json.loads(tags_str)
                elif isinstance(tags_str, list):
                    return tags_str
            except (json.JSONDecodeError, TypeError):
                pass
        return []

    def get_summary_status(self, video_id: str) -> str:
        """Retorna o status de resumo do vídeo."""
        video = self.get_video(video_id)
        if video:
            return video.get("summary_status") or ""
        return ""

    def get_videos_pending_summary(self) -> list:
        """Retorna vídeos completados que ainda não foram resumidos."""
        with self._lock:
            return [
                v for v in self._videos.values()
                if v.get("status") == "completed"
                and not v.get("summary_status")
            ]
