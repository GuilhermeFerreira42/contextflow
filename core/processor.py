
# contextflow/core/processor.py
import threading
import queue
import time
import wx
import os
import uuid
import random
from typing import List, Callable, Dict, Any, Optional

from services.youtube_manager import YouTubeManager
from storage.db_handler import DatabaseHandler
from core.token_engine import count_tokens
from constants import THUMBNAILS_DIR, EXPORTS_DIR

class ProcessingTask:
    def __init__(self, url: str, playlist_id: str = None, playlist_title: str = None):
        self.uuid = str(uuid.uuid4())
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
        
        # Novos callbacks granulares
        self.on_task_queued: Callable[[str, str], None] = None # (uuid, url)
        self.on_task_started: Callable[[str], None] = None # (uuid)
        self.on_metadata_fetched: Callable[[str, str, str], None] = None # (uuid, video_id, title)

    def start_processing(self):
        if not self.active:
            self.active = True
            self.thread = threading.Thread(target=self._worker_loop, daemon=True)
            self.thread.start()

    def stop_processing(self):
        self.active = False

    def add_urls(self, raw_text: str):
        """Recebe texto bruto e inicia processamento em background (não bloqueante)."""
        threading.Thread(target=self._async_resolve_urls, args=(raw_text,), daemon=True).start()

    def _async_resolve_urls(self, raw_text: str):
        """Expande playlists e valida URLs em background."""
        lines = [l.strip() for l in raw_text.split('\n') if l.strip()]
        
        for line in lines:
            try:
                if "list=" in line:
                    # É playlist
                    pl_info = self.yt_manager.get_playlist_info(line)
                    if pl_info and pl_info.get('videos'):
                        pl_id = pl_info['id']
                        pl_title = pl_info['title']
                        for vid_info in pl_info['videos']:
                            v_url = vid_info.get('url') or f"https://www.youtube.com/watch?v={vid_info['id']}"
                            # Verifica cancelamento ou status aqui se necessário
                            self._enqueue_video(v_url, pl_id, pl_title)
                else:
                    self._enqueue_video(line)
            except Exception as e:
                print(f"Erro ao resolver URL {line}: {e}")

    def _enqueue_video(self, url: str, pl_id: str = None, pl_title: str = None):
        if self.yt_manager.validate_url(url):
            task = ProcessingTask(url, pl_id, pl_title)
            self.task_queue.put(task)
            
            # Notifica UI que entrou na fila
            if self.on_task_queued:
                wx.CallAfter(self.on_task_queued, task.uuid, task.url)

    def _worker_loop(self):
        while self.active:
            try:
                task = self.task_queue.get(timeout=1) 
            except queue.Empty:
                continue

            self._process_task(task)
            self.task_queue.task_done()
            
            # Jitter Anti-Blocking: Pausa aleatória entre vídeos
            time.sleep(random.uniform(2.0, 5.0))

    def _process_task(self, task: ProcessingTask):
        try:
            # 0. Notifica Início (Task Started)
            if self.on_task_started:
                wx.CallAfter(self.on_task_started, task.uuid)

            # 1. Metadados
            meta = self.yt_manager.get_video_metadata(task.url)
            
            if meta['status'] == 'error':
                raise Exception("Falha ao obter metadados")

            task.video_id = meta.get('id')
            task.title = meta.get('title')

            # Notifica ID real descoberto
            if self.on_metadata_fetched:
                wx.CallAfter(self.on_metadata_fetched, task.uuid, task.video_id, task.title)
            
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
                'channel_name': meta.get('channel_name'),
                'added_at': meta.get('added_at'),
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

    def export_batch(self, video_ids: List[str], format_type: str, output_path: str, progress_callback: Callable[[int, int, str], None] = None):
        """
        Executa exportação em lote. Deve ser chamado em Thread separada.
        progress_callback signature: (current_index, total, current_item_name)
        """
        import zipfile
        
        total = len(video_ids)
        
        try:
            if format_type == "markdown_single":
                # Single MD File Stream
                with open(output_path, 'w', encoding='utf-8') as f:
                    # Write Header
                    f.write(f"# Exportação ContextFlow\nData: {time.strftime('%Y-%m-%d %H:%M')}\n\n")
                    
                    for i, vid in enumerate(video_ids):
                        meta = next((v for v in self.db_handler.get_all_videos() if v['id'] == vid), None)
                        if meta:
                            if progress_callback:
                                wx.CallAfter(progress_callback, i, total, f"Exportando: {meta['title']}")
                            
                            data = self.db_handler.get_transcript(vid)
                            
                            f.write(f"---\n\n# {meta['title']}\n")
                            f.write(f"**URL:** {meta['url']}\n")
                            f.write(f"**Canal:** {meta.get('channel_name', '-')}\n")
                            f.write(f"**Tokens:** {meta.get('token_count', 0)}\n\n")
                            f.write(f"## Transcrição\n\n")
                            f.write(data['full_text'] if data else "(Sem transcrição)\n")
                            f.write("\n\n")
                            
            elif format_type == "zip":
                 with zipfile.ZipFile(output_path, 'w') as zf:
                    for i, vid in enumerate(video_ids):
                        meta = next((v for v in self.db_handler.get_all_videos() if v['id'] == vid), None)
                        if meta:
                            if progress_callback:
                                wx.CallAfter(progress_callback, i, total, f"Compactando: {meta['title']}")
                                
                            data = self.db_handler.get_transcript(vid)
                            
                            safe_title = "".join([c for c in meta['title'] if c.isalnum() or c in (' ', '-', '_')]).strip()
                            content = f"# {meta['title']}\n\n**URL:** {meta['url']}\n**Canal:** {meta.get('channel_name', '-')}\n\n## Transcrição\n\n{data['full_text'] if data else '(Sem transcrição)'}"
                            
                            zf.writestr(f"{safe_title}.md", content)
            
            # Finish
            if progress_callback:
                wx.CallAfter(progress_callback, total, total, "Concluído!")
                
        except Exception as e:
            print(f"Export Error: {e}")
            if progress_callback:
                wx.CallAfter(progress_callback, total, total, f"Erro: {str(e)}")
