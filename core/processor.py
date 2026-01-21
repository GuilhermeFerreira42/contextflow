
# contextflow/core/processor.py
import threading
import queue
import time
import wx
import os
import uuid
import random
import logging
from typing import List, Callable, Dict, Any, Optional

from services.youtube_manager import YouTubeManager
from core.token_engine import count_tokens
from core.app_state import AppState
from core.export_formatter import ExportFormatter
from constants import THUMBNAILS_DIR

logger = logging.getLogger("contextflow.processor")

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
    Agora integrado ao AppState para garantir Single Source of Truth.
    """
    def __init__(self, app_state: AppState = None):
        self.app_state = app_state or AppState()
        self.task_queue = queue.Queue()
        self.active = False
        self.thread = None
        
        self.yt_manager = YouTubeManager()
        
        # Garante diretório de thumbnails
        os.makedirs(THUMBNAILS_DIR, exist_ok=True)
        
        # Callbacks Legacy (serão mantidos por enquanto para compatibilidade, 
        # mas a UI deve migrar para observar AppState)
        self.on_task_update: Callable[[str, str], None] = None 
        self.on_task_complete: Callable[[Dict[str, Any]], None] = None 
        self.on_error: Callable[[str, str], None] = None
        
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
                            self._enqueue_video(v_url, pl_id, pl_title)
                else:
                    self._enqueue_video(line)
            except Exception as e:
                print(f"Erro ao resolver URL {line}: {e}")

    def _enqueue_video(self, url: str, pl_id: str = None, pl_title: str = None):
        if self.yt_manager.validate_url(url):
            task = ProcessingTask(url, pl_id, pl_title)
            self.task_queue.put(task)
            
            # Registra no AppState como tarefa ativa (temporária)
            self.app_state.add_active_task(task.uuid, {
                'uuid': task.uuid,
                'url': url,
                'status': 'queued',
                'title': 'Aguardando...',
                'playlist_id': pl_id
            })
            
            # Notifica UI (Legacy + AppState Event implícito no add_active_task)
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
            # 0. Notifica Início
            logger.info(f"Starting task for UUID: {task.uuid} (URL: {task.url})")
            self.app_state.update_active_task(task.uuid, {'status': 'downloading'})
            if self.on_task_started:
                wx.CallAfter(self.on_task_started, task.uuid)

            # 1. Metadados
            logger.info(f"Fetching metadata for {task.url}...")
            meta = self.yt_manager.get_video_metadata(task.url)
            
            if meta['status'] == 'error':
                raise Exception("Falha ao obter metadados")

            task.video_id = meta.get('id')
            task.title = meta.get('title')
            
            logger.info(f"Metadata identified: [{task.video_id}] {task.title}")

            # Notifica ID real descoberto
            if self.on_metadata_fetched:
                wx.CallAfter(self.on_metadata_fetched, task.uuid, task.video_id, task.title)
            
            # Atualiza tarefa ativa com ID real
            self.app_state.update_active_task(task.uuid, {'video_id': task.video_id, 'title': task.title})
            
            self._notify_update(task.video_id, "Baixando Thumbnail...")
            
            # Download Thumbnail
            thumb_filename = f"{task.video_id}.jpg"
            thumb_local_path = os.path.join(THUMBNAILS_DIR, thumb_filename)
            thumb_url = meta.get('thumbnail')
            
            if thumb_url and not os.path.exists(thumb_local_path):
                logger.info(f"Downloading thumbnail for {task.video_id}...")
                # FIX: Ensure dir exists before download
                os.makedirs(THUMBNAILS_DIR, exist_ok=True)
                if self.yt_manager.download_thumbnail(thumb_url, thumb_local_path):
                     logger.info(f"Thumbnail saved to {thumb_local_path}")
                else:
                     logger.warning(f"Failed to save thumbnail for {task.video_id}")
            
            final_thumb_path = thumb_local_path if os.path.exists(thumb_local_path) else ""

            self._notify_update(task.video_id, "Baixando Transcrição...")
            logger.info(f"Fetching transcript for {task.video_id}...")
            
            # Prepara dados para AppState (que vai salvar no DB)
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
                'status': 'processing'
            }
            
            # CRITICAL FIX: Ensure UUID is passed to allow UI to promote the row
            video_data['uuid'] = task.uuid

            # Salva metadados iniciais
            self.app_state.add_or_update_video(video_data)

            # 2. Transcrição
            transcript, source = self.yt_manager.get_transcript(task.video_id)
            
            if not transcript:
                raise Exception("Transcrição indisponível")
            
            logger.info(f"Transcript fetched via {source}. Length: {len(transcript)} chars.")

            # 3. Contagem de Tokens
            token_count, _ = count_tokens(transcript)
            logger.info(f"Tokens counted: {token_count}")
            
            # 4. Salvar Transcrição e Finalizar
            self.app_state.db_handler.save_transcript(task.video_id, transcript)
            
            # Atualiza status final
            self.app_state.update_video_status(
                task.video_id, 
                "completed", 
                token_count=token_count
            )
            
            # Limpa active task pois virou video persistido
            self.app_state.remove_active_task(task.uuid)
            
            logger.info(f"Task completed successfully: {task.video_id}")
            self._notify_complete(task.video_id, task.title)

        except Exception as e:
            logger.error(f"Task failed for UUID {task.uuid}: {e}")
            if task.video_id:
                self.app_state.update_video_status(task.video_id, "ERROR")
                self._notify_error(task.video_id, str(e))
                # Remove active task mesmo em erro, pois já está no DB com erro
                self.app_state.remove_active_task(task.uuid)
            else:
                # Erro cedo demais (antes do ID), mantém na active task com erro?
                self.app_state.update_active_task(task.uuid, {'status': 'error', 'error': str(e)})
                self._notify_error("UNKNOWN", str(e))

    def _notify_update(self, video_id, status):
        # Legacy callback
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
        Executa exportação em lote.
        """
        import zipfile
        
        total = len(video_ids)
        
        try:
            if format_type == "markdown_single":
                with open(output_path, 'w', encoding='utf-8') as f:
                    f.write(ExportFormatter.get_single_markdown_header())
                    
                    for i, vid in enumerate(video_ids):
                        meta = self.app_state.get_video(vid)
                        if meta:
                            if progress_callback:
                                wx.CallAfter(progress_callback, i, total, f"Exportando: {meta['title']}")
                            
                            # Transcrição completa vem do DB
                            t_data = self.app_state.db_handler.get_transcript(vid)
                            full_text = t_data['full_text'] if t_data else ""
                            
                            md_content = ExportFormatter.format_video_markdown(meta, full_text)
                            f.write(f"---\n\n{md_content}\n")
                            
            elif format_type == "zip":
                 with zipfile.ZipFile(output_path, 'w') as zf:
                    for i, vid in enumerate(video_ids):
                        meta = self.app_state.get_video(vid)
                        if meta:
                            if progress_callback:
                                wx.CallAfter(progress_callback, i, total, f"Compactando: {meta['title']}")
                                
                            t_data = self.app_state.db_handler.get_transcript(vid)
                            full_text = t_data['full_text'] if t_data else ""
                            
                            md_content = ExportFormatter.format_video_markdown(meta, full_text)
                            filename = f"{ExportFormatter.get_safe_filename(meta['title'])}.md"
                            
                            zf.writestr(filename, md_content)
            
            if progress_callback:
                wx.CallAfter(progress_callback, total, total, "Concluído!")
                
        except Exception as e:
            print(f"Export Error: {e}")
            if progress_callback:
                wx.CallAfter(progress_callback, total, total, f"Erro: {str(e)}")
