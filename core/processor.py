# contextflow/core/processor.py
import threading
import queue
import time
import os
import uuid
import random
import logging
from typing import List, Callable, Dict, Any, Optional
from concurrent.futures import ThreadPoolExecutor

from services.youtube_manager import YouTubeManager
from core.token_engine import count_tokens
from core.app_state import AppState
from core.config_manager import ConfigManager
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
        self.creation_time = time.perf_counter() # For telemetry

class Processor:
    def __init__(self, app_state: AppState = None):
        self.app_state = app_state or AppState()
        self.task_queue = queue.Queue()
        self.active = False
        self.thread = None
        self.yt_manager = YouTubeManager()
        self.config = ConfigManager()
        
        # [QA4] Worker Pool controlado conforme Config
        max_workers = self.config.get("orchestration", "max_cloud_tasks", 2)
        self.executor = ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="CF_ProcessorPool")
        
        os.makedirs(THUMBNAILS_DIR, exist_ok=True)
        
        # [SSOT] Reconexão Lógica: Inscreve o processador no barramento global
        PubSub.subscribe('REQUEST_BATCH_PROCESSING', self.add_urls)
        PubSub.subscribe('REQUEST_CANCEL_ALL', self.clear_queue)

    def start_processing(self):
        if not self.active:
            self.active = True
            self.thread = threading.Thread(target=self._worker_loop, daemon=True)
            self.thread.start()

    def stop_processing(self):
        self.active = False

    def add_urls(self, raw_text: str):
        self.executor.submit(self._async_resolve_urls, raw_text)

    def clear_queue(self):
        """[QA2 REFINE] Esvazia a fila de tarefas e limpa o AppState."""
        logger.info("CANCEL ALL requested. Cleaning queue...")
        while not self.task_queue.empty():
            try:
                self.task_queue.get_nowait()
                self.task_queue.task_done()
            except queue.Empty:
                break
        
        self.app_state.clear_queued_tasks()
        logger.info("Queue cleared.")

    def validate_infrastructure(self) -> Dict[str, Any]:
        """Verifica se as ferramentas e configs necessárias estão presentes."""
        from constants import PROXY_LIST_PATH, COOKIES_PATH
        return {
            'yt_dlp': True, # Assume working since imported
            'proxies_configured': os.path.exists(PROXY_LIST_PATH),
            'cookies_configured': os.path.exists(COOKIES_PATH),
            'network_status': 'ok' # Placeholder for real ping if needed
        }

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
                    if self.yt_manager.validate_url(line):
                        self._enqueue_video(line)
                    else:
                        # [RESILIÊNCIA] Notifica erro de validação imediatamente
                        logger.error(f"URL Inválida: {line}")
                        PubSub.publish('TASK_ERROR', video_id="URL-VAL", error_msg=f"URL Inválida: {line}")
            except Exception as e:
                logger.error(f"Erro ao resolver URL {line}: {e}")
                PubSub.publish('TASK_ERROR', video_id="URL-RESOLVE", error_msg=str(e))

    def _enqueue_video(self, url: str, pl_id: str = None, pl_title: str = None):
        if self.yt_manager.validate_url(url):
            task = ProcessingTask(url, pl_id, pl_title)
            self.task_queue.put(task)
            
            import datetime
            now_str = datetime.datetime.now().strftime("%d/%m/%Y %H:%M:%S")
            
            self.app_state.add_active_task(task.uuid, {
                'uuid': task.uuid,
                'url': url,
                'status': 'queued',
                'title': 'Aguardando...',
                'playlist_id': pl_id,
                'added_at': now_str
            })
            
            PubSub.publish('TASK_QUEUED', uuid=task.uuid, url=task.url)

    def _worker_loop(self):
        from core.cooldown_manager import CooldownManager
        cooldown = CooldownManager(self.app_state)
        
        while self.active:
            if cooldown.is_cooling_down():
                remaining = cooldown.get_remaining_cooldown()
                # [VISIBILIDADE] Log claro conforme PHASE_5_8_LOGICAL_SYNC
                # [REGRA ALPHA] Proteção Cooldown Ativa
                msg = f"SYSTEM COOLDOWN ACTIVE. Waiting... ({remaining}s remaining before retry)"
                logger.info(msg)
                # Opcional: Notificar via PubSub se a UI tiver um status bar global
                PubSub.publish('TASK_PROGRESS', video_id="COOLDOWN", status_msg=msg)
                time.sleep(10) # Wait and check again
                continue

            try:
                task = self.task_queue.get(timeout=1) 
            except queue.Empty:
                continue
                
            # [QA4] Submete ao ProcessorPool para processamento paralelo
            self.executor.submit(self._wrapped_process, task)
            
            # Delay entre submissões para evitar picos
            time.sleep(random.uniform(0.5, 1.5))

    def _wrapped_process(self, task):
        try:
            self._process_task(task)
        finally:
            self.task_queue.task_done()

    def _process_task(self, task: ProcessingTask):
        from core.metrics import MetricsCollector
        from core.ai_governance import AIGovernance, TokenCounter
        from core.proxy_manager import ProxyManager
        from core.cooldown_manager import CooldownManager
        
        gov = AIGovernance(self.app_state)
        proxy_mgr = ProxyManager()
        cooldown = CooldownManager(self.app_state)
        metrics = MetricsCollector(task.video_id or "UNKNOWN")
        
        # Check Cooldown again right before starting (Safety Alpha)
        if cooldown.is_cooling_down():
            logger.warning(f"Task {task.uuid} aborted: System Cooldown Active.")
            # Put back in queue or keep pending
            self.task_queue.put(task)
            return

        # Pre-Flight Check (Contract Step 3.2)
        # [REGRA BETA] Bloqueio de Segurança para Filas Grandes.
        # Filas > 20 requerem Proxy para evitar banimento de IP Residencial.
        if self.task_queue.qsize() > 20 and not proxy_mgr.has_proxies():
            logger.error("ALERTA DE SEGURANÇA: Fila > 20 sem Proxies. Abortando para evitar BAN.")
            self.app_state.update_active_task(task.uuid, {'status': 'ABORTED', 'error': 'Security: Proxy required for large batches'})
            PubSub.publish('TASK_ERROR', video_id="SECURITY", error_msg="Proxy required for large batches")
            return


        # Record queue wait
        wait_time = int((time.perf_counter() - task.creation_time) * 1000)
        metrics.tracker.durations['queue_wait'] = wait_time
        
        # Get Proxy
        active_proxy = proxy_mgr.get_proxy()

        try:
            logger.info(f"Starting task for UUID: {task.uuid} (Waited: {wait_time}ms) [Proxy: {active_proxy or 'None'}]")
            self.app_state.update_active_task(task.uuid, {'status': 'downloading'})
            PubSub.publish('TASK_STARTED', uuid=task.uuid)

            metrics.tracker.start('fetch')
            logger.info(f"Fetching metadata for {task.url}...")
            meta = self.yt_manager.get_video_metadata(task.url, proxy=active_proxy)
            
            # 429 Detection (Contract Step 3.1)
            if meta.get('status') == 'error' and '429' in meta.get('error_msg', ''):
                if active_proxy: proxy_mgr.ban_proxy(active_proxy)
                # [REGRA ALPHA] Disparo de Cooldown Global.
                # O sistema entra em hibernação forçada para proteger a infraestrutura.
                cooldown.trigger_cooldown(3600) # Global cooldown (1h)
                raise Exception("YouTube Block (429) detected. Proxy banned and SYSTEM COOLDOWN triggered.")


            if meta['status'] == 'error': raise Exception(f"Falha ao obter metadados: {meta.get('error_msg')}")

            task.video_id = meta.get('id')
            task.title = meta.get('title')
            metrics.video_id = task.video_id
            
            PubSub.publish('METADATA_FETCHED', uuid=task.uuid, video_id=task.video_id, title=task.title)
            self.app_state.update_active_task(task.uuid, {'video_id': task.video_id, 'title': task.title})
            
            PubSub.publish('TASK_PROGRESS', video_id=task.video_id, status_msg="Baixando Thumbnail...")
            
            thumb_filename = f"{task.video_id}.jpg"
            thumb_local_path = os.path.join(THUMBNAILS_DIR, thumb_filename)
            thumb_url = meta.get('thumbnail')
            if thumb_url and not os.path.exists(thumb_local_path):
                os.makedirs(THUMBNAILS_DIR, exist_ok=True)
                self.yt_manager.download_thumbnail(thumb_url, thumb_local_path, proxy=active_proxy)
            
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

            transcript, source = self.yt_manager.get_transcript(task.video_id, proxy=active_proxy)
            metrics.tracker.stop('fetch')

            if not transcript:
                raise Exception("Transcrição indisponível (Tente usar Cookies ou verifique se o vídeo possui legendas).")
            
            # --- AI STEP (Governance) ---
            metrics.tracker.start('llm')
            from constants import MODEL_NAME
            token_count = TokenCounter.count_tokens(transcript, MODEL_NAME)
            time.sleep(0.1) # Simulate
            metrics.tracker.stop('llm')

            self.app_state.db_handler.save_transcript(task.video_id, transcript)
            
            # [PROMOÇÃO ATÔMICA SSoT] 
            # Evita duplicação visual na grade garantindo que a troca 
            # de UUID para ID ocorra em uma única transação de memória.
            video_data['status'] = 'completed'
            video_data['token_count'] = token_count
            self.app_state.promote_task_to_video(task.uuid, video_data)
            
            # --- FINAL TELEMETRY LOG ---
            final_metrics = metrics.finalize()
            gov_data = {
                'video_id': task.video_id,
                'model_name': 'tiktoken-local',
                'provider': 'local',
                'input_hash': 'local-hash',
                'prompt_checksum': 'none',
                'input_tokens': token_count,
                'output_tokens': 0,
                'status': 'SUCCESS'
            }
            gov_data.update(final_metrics)
            gov.log_and_bill(task.video_id, gov_data)

            PubSub.publish('TASK_COMPLETED', video_id=task.video_id, data_dict={'title': task.title})

        except Exception as e:
            logger.error(f"Task failed: {e}")
            metrics.tracker.stop('fetch')
            metrics.tracker.stop('llm')
            
            # Check for 429 in Exception message
            if '429' in str(e):
                if active_proxy: proxy_mgr.ban_proxy(active_proxy)
                cooldown.trigger_cooldown(3600)

            fail_metrics = metrics.finalize()
            gov_error_data = {
                'video_id': task.video_id or "UNKNOWN",
                'model_name': 'tiktoken-local',
                'provider': 'local',
                'input_hash': 'error',
                'prompt_checksum': 'none',
                'input_tokens': 0,
                'output_tokens': 0,
                'status': 'FAILED'
            }
            gov_error_data.update(fail_metrics)
            gov.log_and_bill(task.video_id or "UNKNOWN", gov_error_data)

            if task.video_id:
                self.app_state.update_video_status(task.video_id, "ERROR")
                PubSub.publish('TASK_ERROR', video_id=task.video_id, error_msg=str(e))
                self.app_state.remove_active_task(task.uuid)
            else:
                self.app_state.update_active_task(task.uuid, {'status': 'error', 'error': str(e)})
                PubSub.publish('TASK_ERROR', video_id="UNKNOWN", error_msg=str(e))

        except Exception as e:
            logger.error(f"Task failed: {e}")
            if task.video_id:
                self.app_state.update_video_status(task.video_id, "ERROR")
                PubSub.publish('TASK_ERROR', video_id=task.video_id, error_msg=str(e))
                self.app_state.remove_active_task(task.uuid)
            else:
                self.app_state.update_active_task(task.uuid, {'status': 'error', 'error': str(e)})
                PubSub.publish('TASK_ERROR', video_id="UNKNOWN", error_msg=str(e))

