# contextflow/core/processor.py
import threading
import queue
import time
import os
import uuid
import random
import logging
from typing import List, Callable, Dict, Any, Optional

from services.youtube_manager import YouTubeManager
from core.token_engine import count_tokens
from core.app_state import AppState
from core.pubsub import PubSub
from constants import THUMBNAILS_DIR

logger = logging.getLogger("contextflow.processor")

class ProcessingTask:
    def __init__(self, url: str, playlist_id: str = None, playlist_title: str = None):
        self.uuid = str(uuid.uuid4())
        self.url = url
        self.status = "pending"
        self.video_id = None
        self.title = "Aguardando..."
        self.error_msg = ""
        self.playlist_id = playlist_id
        self.playlist_title = playlist_title

class Processor:
    def __init__(self, app_state: AppState = None):
        self.app_state = app_state or AppState()
        self.task_queue = queue.Queue()
        self.active = False
        self.thread = None
        self.yt_manager = YouTubeManager()
        os.makedirs(THUMBNAILS_DIR, exist_ok=True)

    def start_processing(self):
        if not self.active:
            self.active = True
            self.thread = threading.Thread(target=self._worker_loop, daemon=True)
            self.thread.start()

    def stop_processing(self):
        self.active = False

    def add_urls(self, raw_text: str):
        threading.Thread(target=self._async_resolve_urls, args=(raw_text,), daemon=True).start()

    def _async_resolve_urls(self, raw_text: str):
        lines = [l.strip() for l in raw_text.split('\n') if l.strip()]
        for line in lines:
            try:
                if "list=" in line:
                    pl_info = self.yt_manager.get_playlist_info(line)
                    if pl_info and pl_info.get('videos'):
                        pl_id = pl_info['id']
                        pl_title = pl_info['title']
                        for vid_info in pl_info['videos']:
                            v_url = vid_info.get('url') or f"https://www.youtube.com/watch?v={vid_info['id']}"
                            self._enqueue_video(v_url, pl_id, pl_title)
                else:
                    self._enqueue_video(line)
            except Exception as e:
                print(f"Erro ao resolver URL {line}: {e}")

    def _enqueue_video(self, url: str, pl_id: str = None, pl_title: str = None):
        if self.yt_manager.validate_url(url):
            task = ProcessingTask(url, pl_id, pl_title)
            self.task_queue.put(task)
            
            self.app_state.add_active_task(task.uuid, {
                'uuid': task.uuid,
                'url': url,
                'status': 'queued',
                'title': 'Aguardando...',
                'playlist_id': pl_id
            })
            
            PubSub.publish('TASK_QUEUED', uuid=task.uuid, url=task.url)

    def _worker_loop(self):
        while self.active:
            try:
                task = self.task_queue.get(timeout=1) 
            except queue.Empty:
                continue
            self._process_task(task)
            self.task_queue.task_done()
            time.sleep(random.uniform(2.0, 5.0))

    def _process_task(self, task: ProcessingTask):
        try:
            logger.info(f"Starting task for UUID: {task.uuid}")
            self.app_state.update_active_task(task.uuid, {'status': 'downloading'})
            PubSub.publish('TASK_STARTED', uuid=task.uuid)

            logger.info(f"Fetching metadata for {task.url}...")
            meta = self.yt_manager.get_video_metadata(task.url)
            if meta['status'] == 'error': raise Exception("Falha ao obter metadados")

            task.video_id = meta.get('id')
            task.title = meta.get('title')
            
            PubSub.publish('METADATA_FETCHED', uuid=task.uuid, video_id=task.video_id, title=task.title)
            self.app_state.update_active_task(task.uuid, {'video_id': task.video_id, 'title': task.title})
            
            PubSub.publish('TASK_PROGRESS', video_id=task.video_id, status_msg="Baixando Thumbnail...")
            
            thumb_filename = f"{task.video_id}.jpg"
            thumb_local_path = os.path.join(THUMBNAILS_DIR, thumb_filename)
            thumb_url = meta.get('thumbnail')
            if thumb_url and not os.path.exists(thumb_local_path):
                os.makedirs(THUMBNAILS_DIR, exist_ok=True)
                self.yt_manager.download_thumbnail(thumb_url, thumb_local_path)
            
            final_thumb_path = thumb_local_path if os.path.exists(thumb_local_path) else ""

            PubSub.publish('TASK_PROGRESS', video_id=task.video_id, status_msg="Baixando Transcrição...")
            
            video_data = {
                'id': task.video_id,
                'url': task.url,
                'title': task.title,
                'duration': meta.get('duration'),
                'duration_seconds': meta.get('duration_seconds'),
                'upload_date': meta.get('upload_date'),
                'thumbnail_path': final_thumb_path,
                'playlist_id': task.playlist_id,
                'playlist_title': task.playlist_title,
                'channel_name': meta.get('channel_name'),
                'added_at': meta.get('added_at'),
                'status': 'processing',
                'uuid': task.uuid
            }
            self.app_state.add_or_update_video(video_data)

            transcript, source = self.yt_manager.get_transcript(task.video_id)
            if not transcript: raise Exception("Transcrição indisponível")
            
            token_count, _ = count_tokens(transcript)
            self.app_state.db_handler.save_transcript(task.video_id, transcript)
            self.app_state.update_video_status(task.video_id, "completed", token_count=token_count)
            self.app_state.remove_active_task(task.uuid)
            
            PubSub.publish('TASK_COMPLETED', video_id=task.video_id, data_dict={'title': task.title})

        except Exception as e:
            logger.error(f"Task failed: {e}")
            if task.video_id:
                self.app_state.update_video_status(task.video_id, "ERROR")
                PubSub.publish('TASK_ERROR', video_id=task.video_id, error_msg=str(e))
                self.app_state.remove_active_task(task.uuid)
            else:
                self.app_state.update_active_task(task.uuid, {'status': 'error', 'error': str(e)})
                PubSub.publish('TASK_ERROR', video_id="UNKNOWN", error_msg=str(e))

