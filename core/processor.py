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
    def __init__(self, url: str, playlist_id: str = None, playlist_title: str = None, **kwargs):
        # [FIX] Suporte a argumentos extras para restauração de fila (uuid, video_id, title)
        # Evita TypeError: got an unexpected keyword argument 'uuid'
        self.uuid = kwargs.get('uuid') or str(uuid.uuid4())
        self.url = url
        self.status = "pending"
        self.video_id = kwargs.get('video_id')
        self.title = kwargs.get('title') or "Aguardando..."
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
        self.local_semaphore = threading.Semaphore(1) # [BLINDAGEM 5.12] Trava rígida para Ollama
        
        # [QA4] Worker Pool controlado conforme Config
        max_workers = self.config.get("orchestration", "max_cloud_tasks", 2)
        self.executor = ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="CF_ProcessorPool")
        self._cancel_requested = False # Flag para interrupção imediata
        
        os.makedirs(THUMBNAILS_DIR, exist_ok=True)
        
        PubSub.subscribe('REQUEST_BATCH_PROCESSING', self.add_urls)
        PubSub.subscribe('REQUEST_CANCEL_ALL', self.clear_queue)
        PubSub.subscribe('CONFIRMED_MASSIVE_QUEUE', self._enqueue_buffer)
        PubSub.subscribe('REQUEST_SUMMARY', self.request_summary) # [FASE 6]
        
        self._massive_buffer = [] # Buffer temporário para confirmação UI

    def start_processing(self):
        if not self.active:
            self.active = True
            
            # [PHASE_5_12] Restauração de Fila persistente
            if self.config.get("orchestration", "resume_tasks", True):
                self._resume_interrupted_tasks()
            
            self._cancel_requested = False # Reset flag local
            self.app_state.set_cancel_requested(False) # [PHASE_5_12] Reset Kill-Switch
            self.thread = threading.Thread(target=self._worker_loop, daemon=True)
            self.thread.start()
            logger.info("Motor de Processamento ContextFlow ATIVADO.")

    def stop_processing(self):
        self.active = False

    def _resume_interrupted_tasks(self):
        """
        [PHASE_5_12] Busca vídeos que ficaram 'presos' em processamento (ou pendentes) 
        antes do desligamento e os devolve à fila.
        """
        all_videos = self.app_state.get_all_videos()
        interrupted = [v for v in all_videos if v.get('status') in ['processing', 'downloading', 'queued']]
        
        if not interrupted: return
        
        logger.info(f"Retomando {len(interrupted)} tarefas interrompidas...")
        for v in interrupted:
            task = ProcessingTask(
                url=v['url'],
                uuid=v.get('uuid') or str(uuid.uuid4()),
                playlist_id=v.get('playlist_id'),
                playlist_title=v.get('playlist_title'),
                title=v.get('title'),
                video_id=v['id']
            )
            # Reverte status para 'queued' visualmente antes de entrar no worker
            self.app_state.update_video_status(v['id'], 'queued')
            self.task_queue.put(task)

    def add_urls(self, raw_text: str):
        # [PHASE_5_12] Garante que novas solicitações limpem o sinal de cancelamento anterior
        self._cancel_requested = False
        self.app_state.set_cancel_requested(False)
        self.executor.submit(self._async_resolve_urls, raw_text)

    def clear_queue(self):
        """[QA2 REFINE] Esvazia a fila de tarefas e sinaliza cancelamento imediato."""
        logger.info("CANCEL ALL requested. Cleaning queue and signaling cancel...")
        self._cancel_requested = True # Flag local (Retrocompatibilidade)
        self.app_state.set_cancel_requested(True) # [PHASE_5_12] Kill-Switch SSoT
        
        # [PHASE_5_12] Purge Strategy: Remove todos os itens incompletos da UI
        # Isso evita ruído visual e simplifica a re-entrada.
        self.app_state.purge_active_tasks()
        
        while not self.task_queue.empty():
            try:
                self.task_queue.get_nowait()
                self.task_queue.task_done()
            except queue.Empty:
                break
        
        PubSub.publish('ALL_TASKS_STOPPED') # [PHASE_5_12] Força fechamento do gauge global
        logger.info("Queue cleared and non-completed tasks purged.")

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
        resolved_tasks = []
        
        for line in lines:
            if self.app_state.is_cancel_requested():
                logger.info("URL resolution aborted due to global cancellation.")
                return

            try:
                if "list=" in line:
                    pl_info = self.yt_manager.get_playlist_info(line)
                    if pl_info and pl_info.get('videos'):
                        for vid_info in pl_info['videos']:
                            if self.app_state.is_cancel_requested(): return
                            v_url = vid_info.get('url') or f"https://www.youtube.com/watch?v={vid_info['id']}"
                            resolved_tasks.append((v_url, pl_info['id'], pl_info['title']))
                else:
                    if self.yt_manager.validate_url(line):
                        resolved_tasks.append((line, None, None))
            except Exception as e:
                logger.error(f"Erro ao resolver URL {line}: {e}")

        # [BLINDAGEM 5.12] Lógica de Fila (Aviso vs. Aborto)
        max_warning = self.config.get("orchestration", "max_queue_warning", 20)
        
        if len(resolved_tasks) > max_warning:
            self._massive_buffer = resolved_tasks
            PubSub.publish('CONFIRM_MASSIVE_QUEUE', count=len(resolved_tasks))
        else:
            for task_data in resolved_tasks:
                self._enqueue_video(*task_data)

    def _enqueue_buffer(self):
        """Callback após confirmação manual na UI."""
        if self._massive_buffer:
            for task_data in self._massive_buffer:
                self._enqueue_video(*task_data)
            self._massive_buffer = []

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
                # [GOVERNANÇA v5.12] Terminologia amigável
                msg = f"INTERVALO DE ESPERA ATIVO. Aguardando... ({remaining}s restantes antes de retomar)"
                logger.info(msg)
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
        from services.youtube_manager import DownloadCancelledException
        # [PHASE_5_12] Check cancel request immediate
        if self.app_state.is_cancel_requested():
            logger.info(f"Task {task.uuid} aborted due to user cancellation.")
            self.app_state.update_active_task(task.uuid, {'status': 'CANCELLED', 'error': 'Cancelado pelo usuário'})
            return

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

        # [GOVERNANÇA v5.12] Limite dinâmico de fila via ConfigManager
        auto_defense = self.config.get("orchestration", "auto_defense_enabled", True)
        from core.proxy_manager import ProxyManager
        proxy_mgr = ProxyManager()

        if self.task_queue.qsize() > 50 and auto_defense and not proxy_mgr.has_proxies():
             logger.warning("Fila crítica sem proxies. Risco de bloqueio IP aumentado.")


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
            
            if self.app_state.is_cancel_requested():
                logger.info(f"Task {task.uuid} stopped after metadata fetch.")
                self.app_state.update_active_task(task.uuid, {'status': 'CANCELLED'})
                return
            if meta.get('status') == 'error' and '429' in meta.get('error_msg', ''):
                if active_proxy: proxy_mgr.ban_proxy(active_proxy)
                
                # [GOVERNANÇA v5.12] Defesa condicionada à flag do usuário
                if auto_defense:
                    cooldown_time = self.config.get("extraction_defense", "cooldown_secs", 3600)
                    cooldown.trigger_cooldown(cooldown_time)
                    raise Exception(f"LIMITE DE FALHAS (429) detectado. IP pausado por {cooldown_time} segundos.")
                else:
                    logger.warning("Erro 429 detectado, mas PROTEÇÃO AUTOMÁTICA está DESATIVADA. Prosseguindo por conta e risco.")


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
            # [BLINDAGEM 5.12] Trava de Hardware para Provedores Locais
            is_local = self.config.get("orchestration", "active_provider", "openai") == "ollama"
            
            with (self.local_semaphore if is_local else threading.Lock()):
                metrics.tracker.start('llm')
                from constants import MODEL_NAME
                token_count = TokenCounter.count_tokens(transcript, MODEL_NAME)
                # Simulação ou Chamada Real aqui...
                time.sleep(0.1) 
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

        except DownloadCancelledException:
            logger.info(f"Task {task.uuid} suppressed error update due to atomic cancellation.")
            self.app_state.update_active_task(task.uuid, {'status': 'CANCELLED'})
            return
        except Exception as e:
            if self.app_state.is_cancel_requested():
                logger.info(f"Task {task.uuid} suppressed error update due to global cancellation.")
                self.app_state.update_active_task(task.uuid, {'status': 'CANCELLED'})
                return

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

    def request_summary(self, video_id: str):
        """[FASE 6] Enfileira pedido de resumo para um vídeo."""
        logger.info(f"Summary requested for video: {video_id}")
        self.executor.submit(self._process_summary, video_id)

    def _process_summary(self, video_id: str):
        """
        Executa a geração do resumo com streaming.
        Respeita a Single Source of Truth e as travas de hardware.
        """
        from core.provider_factory import ProviderFactory
        from core.ai_governance import AIGovernance
        import time

        gov = AIGovernance(self.app_state)
        
        # 1. Obter transcrição
        transcript_data = self.app_state.db_handler.get_transcript(video_id)
        if not transcript_data or not transcript_data.get('full_text'):
            logger.error(f"Transcrição não encontrada para {video_id}. Não é possível resumir.")
            return

        transcript = transcript_data['full_text']
        
        # 2. Configurar Provedor
        provider_name = self.config.get("orchestration", "active_provider", "openai")
        model_name = self.config.get("orchestration", f"{provider_name}_model", "gpt-4o-mini")
        
        # Para Ollama, buscar o modelo específico se configurado
        if provider_name == "ollama":
            model_name = self.config.get("ollama", "model", "llama3")
        
        adapter = ProviderFactory.get_adapter(provider_name)
        
        ai_config = {
            "api_key": self.config.get("credentials", f"{provider_name}_api_key"),
            "model": model_name,
            "base_url": self.config.get("ollama", "base_url", "http://localhost:11434") if provider_name == "ollama" else None
        }

        # 3. Preparar Prompt e Cache
        prompt_template = self.config.get("ai_prompts", "summary_v1", "Resuma o seguinte conteúdo: {transcript}")
        
        h_key, checksum, cached = gov.pre_api_call(video_id, transcript, prompt_template, model_name, provider_name)
        
        if cached:
            logger.info(f"Summary Cache Hit for {video_id}.")
            self.app_state.update_live_summary(video_id, cached.get('content', ''))
            self.app_state.save_summary(video_id, cached)
            return

        # 4. Pre-flight Check Financeiro
        est_input = adapter.count_tokens(prompt_template.format(transcript=transcript))
        est_cost = gov.cost_calculator.estimate_cost(est_input, 500, model_name, provider_name) # Estima 500 tokens de output
        
        if not gov.check_session_budget(est_cost):
            msg = f"Orçamento da sessão insuficiente para resumir '{video_id}' (Est. ${est_cost})."
            logger.error(msg)
            PubSub.publish('SUMMARY_ERROR', video_id=video_id, error=msg)
            return

        # 5. Executar com Trava de Hardware (Ollama) e Streaming
        is_local = provider_name == "ollama"
        lock = self.local_semaphore if is_local else threading.Lock()
        
        full_text = ""
        last_ui_update = time.time()
        
        try:
            PubSub.publish('SUMMARY_STARTED', video_id=video_id)
            
            with lock:
                stream = adapter.generate_summary_stream(transcript, prompt_template, ai_config)
                
                for chunk in stream:
                    if self.app_state.is_cancel_requested():
                        logger.info("Summary generation cancelled by user.")
                        break
                        
                    full_text += chunk
                    
                    # [PROTOCOL ANTI-FLICKER] Buffer 500ms ou 100 caracteres
                    now = time.time()
                    if now - last_ui_update > 0.5 or len(full_text) % 100 == 0:
                        self.app_state.update_live_summary(video_id, full_text)
                        last_ui_update = now

                final_data = {
                    "content": full_text,
                    "provider": provider_name,
                    "model": model_name,
                    "prompt_hash": checksum,
                    "status": "SUCCESS"
                }
                
                # Recalcular tokens para governança
                final_data['input_tokens'] = adapter.count_tokens(prompt_template.format(transcript=transcript))
                final_data['output_tokens'] = adapter.count_tokens(full_text)
                
                # Persistir no banco e notificar finalização
                self.app_state.save_summary(video_id, final_data)
                
                # Registrar no Cofre Financeiro
                gov_log = {
                    'video_id': video_id,
                    'model_name': model_name,
                    'provider': provider_name,
                    'input_hash': h_key,
                    'prompt_checksum': checksum,
                    'input_tokens': final_data['input_tokens'],
                    'output_tokens': final_data['output_tokens'],
                    'status': 'SUCCESS'
                }
                gov.log_and_bill(video_id, gov_log)
                
                # Salvar no Cache
                gov.cache_manager.save_to_cache(h_key, final_data, checksum, model_name)

        except Exception as e:
            logger.error(f"Erro ao gerar resumo para {video_id}: {e}")
            PubSub.publish('SUMMARY_ERROR', video_id=video_id, error=str(e))

