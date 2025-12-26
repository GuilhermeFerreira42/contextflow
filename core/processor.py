
# contextflow/core/processor.py
import threading
import queue
import time
import wx
import os
from typing import List, Callable, Dict, Any, Optional

from services.youtube_manager import YouTubeManager
from storage.db_handler import DatabaseHandler
from core.token_engine import count_tokens
from constants import THUMBNAILS_DIR, EXPORTS_DIR

class ProcessingTask:
    def __init__(self, url: str, playlist_id: str = None, playlist_title: str = None):
        self.url = url
        self.status = "pending" # pending, downloading, transcribing, completed, error
        self.video_id = None
        self.title = "Aguardando..."
        self.error_msg = ""
        self.playlist_id = playlist_id
        self.playlist_title = playlist_title

class Processor:
    """
    Controlador central de processamento.
    Gerencia a fila de vídeos e executa as etapas de download/transcrição em background.
    """
    def __init__(self):
        self.task_queue = queue.Queue()
        self.active = False
        self.thread = None
        
        self.yt_manager = YouTubeManager()
        self.db_handler = DatabaseHandler()
        
        # Garante diretório de thumbnails
        os.makedirs(THUMBNAILS_DIR, exist_ok=True)
        
        # Callbacks para atualização da UI
        self.on_task_update: Callable[[str, str], None] = None 
        self.on_task_complete: Callable[[Dict[str, Any]], None] = None 
        self.on_error: Callable[[str, str], None] = None

    def start_processing(self):
        if not self.active:
            self.active = True
            self.thread = threading.Thread(target=self._worker_loop, daemon=True)
            self.thread.start()

    def stop_processing(self):
        self.active = False

    def add_urls(self, raw_text: str):
        """Recebe texto bruto com várias URLs/Playlists e enfileira."""
        lines = [l.strip() for l in raw_text.split('\n') if l.strip()]
        
        for line in lines:
            if "list=" in line:
                # É playlist
                pl_info = self.yt_manager.get_playlist_info(line)
                if pl_info and pl_info.get('videos'):
                    pl_id = pl_info['id']
                    pl_title = pl_info['title']
                    for vid_info in pl_info['videos']:
                        v_url = vid_info.get('url') or f"https://www.youtube.com/watch?v={vid_info['id']}"
                        self._enqueue_video(v_url, pl_id, pl_title)
            else:
                self._enqueue_video(line)

    def _enqueue_video(self, url: str, pl_id: str = None, pl_title: str = None):
        if self.yt_manager.validate_url(url):
            self.task_queue.put(ProcessingTask(url, pl_id, pl_title))

    def _worker_loop(self):
        while self.active:
            try:
                task = self.task_queue.get(timeout=1) 
            except queue.Empty:
                continue

            self._process_task(task)
            self.task_queue.task_done()

    def _process_task(self, task: ProcessingTask):
        try:
            # 1. Metadados
            meta = self.yt_manager.get_video_metadata(task.url)
            task.video_id = meta.get('id')
            task.title = meta.get('title')
            
            if meta['status'] == 'error':
                raise Exception("Falha ao obter metadados")

            self._notify_update(task.video_id, "Baixando Thumbnail...")
            
            # Download Thumbnail
            thumb_filename = f"{task.video_id}.jpg"
            thumb_local_path = os.path.join(THUMBNAILS_DIR, thumb_filename)
            thumb_url = meta.get('thumbnail')
            
            if thumb_url and not os.path.exists(thumb_local_path):
                self.yt_manager.download_thumbnail(thumb_url, thumb_local_path)
            
            # Se falhar ou não existir, deixar path vazio ou padrão
            final_thumb_path = thumb_local_path if os.path.exists(thumb_local_path) else ""

            self._notify_update(task.video_id, "Baixando Transcrição...")
            
            # Salva metadados iniciais no banco
            self.db_handler.add_video_entry({
                'id': task.video_id,
                'url': task.url,
                'title': task.title,
                'duration': meta.get('duration'),
                'upload_date': meta.get('upload_date'),
                'thumbnail_path': final_thumb_path,
                'playlist_id': task.playlist_id,
                'playlist_title': task.playlist_title,
                'status': 'processing'
            })

            # 2. Transcrição
            transcript, source = self.yt_manager.get_transcript(task.video_id)
            
            if not transcript:
                raise Exception("Transcrição indisponível")

            # 3. Contagem de Tokens
            token_count, _ = count_tokens(transcript)
            
            # 4. Salvar
            self.db_handler.save_transcript(task.video_id, transcript)
            self.db_handler.update_video_status(task.video_id, "completed", token_count)
            
            self._notify_complete(task.video_id, task.title)

        except Exception as e:
            if task.video_id:
                self.db_handler.update_video_status(task.video_id, "error")
                self._notify_error(task.video_id, str(e))
            else:
                self._notify_error("UNKNOWN", str(e))

    def _notify_update(self, video_id, status):
        if self.on_task_update:
            wx.CallAfter(self.on_task_update, video_id, status)

    def _notify_complete(self, video_id, title):
        if self.on_task_complete:
            wx.CallAfter(self.on_task_complete, {'id': video_id, 'title': title})

    def _notify_error(self, video_id, error_msg):
        if self.on_error:
            wx.CallAfter(self.on_error, video_id, error_msg)

    def export_data(self, video_ids: List[str], format_type: str = "markdown") -> str:
        """
        Gera arquivos de exportação.
        """
        import zipfile
        
        os.makedirs(EXPORTS_DIR, exist_ok=True)
        timestamp = int(time.time())
        
        if format_type == "markdown":
            zip_name = f"export_contextflow_{timestamp}.zip"
            zip_path = os.path.join(EXPORTS_DIR, zip_name)
            
            with zipfile.ZipFile(zip_path, 'w') as zf:
                for vid in video_ids:
                    data = self.db_handler.get_transcript(vid)
                    meta = next((v for v in self.db_handler.get_all_videos() if v['id'] == vid), None)
                    
                    if data and meta:
                        safe_title = "".join([c for c in meta['title'] if c.isalnum() or c in (' ', '-', '_')]).strip()
                        pl_info = f"\n**Playlist:** {meta['playlist_title']}" if meta.get('playlist_title') else ""
                        
                        content = f"# {meta['title']}\n\n**URL:** {meta['url']}\n**Tokens:** {meta['token_count']}{pl_info}\n\n## Transcrição\n\n{data['full_text']}"
                        
                        zf.writestr(f"{safe_title}.md", content)
            
            return zip_path
        
        return ""
