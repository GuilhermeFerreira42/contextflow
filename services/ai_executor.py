# contextflow/services/ai_executor.py
"""
Orquestrador de resumo de vídeos com IA.
[FASE 6.1a] Pipeline: video_id → transcrição → IA → persistência.

DECISÕES VALIDADAS POR TESTES:
- HTTP direto via requests (não subprocess)
- format: "json" no payload (força JSON válido)
- Schema: {summary, tags, language}
- Map-Reduce encapsulado (transparente para a UI)
"""
import json
import logging
import time
from typing import Dict, Any, Optional, List

from core.config_manager import ConfigManager
from core.app_state import AppState
from core.ai_governance import AIGovernance, TokenCounter
from core.pubsub import PubSub
# [Fase 6.1a] Import count_tokens from token_engine
from core.ai_governance import TokenCounter

def count_tokens(text: str) -> tuple[int, str]:
    # Placeholder para count_tokens se não houver token_engine isolado
    return TokenCounter.count_tokens(text), "cl100k_base"

from services.ai_provider import AIProvider, AIProviderError
from services.ai_providers.ollama_provider import OllamaProvider
from services.ai_providers.google_provider import GoogleProvider
from services.ai_discovery import AIDiscovery
from constants import (
    SUMMARY_SYSTEM_PROMPT,
    SUMMARY_MAP_PROMPT,
    SUMMARY_REDUCE_PROMPT,
    CONTEXTFLOW_JSON_SCHEMA,
    AI_CONTEXT_USAGE_RATIO,
    AI_MAP_CHUNK_RATIO,
    AI_DEFAULT_CONTEXT_FALLBACK
)

logger = logging.getLogger("contextflow.ai.executor")


class AIExecutor:
    """
    Orquestrador central de sumarização.
    
    [THREAD SAFETY] Cada chamada a execute_summary() opera com seu próprio
    video_id. Sem estado compartilhado entre chamadas.
    
    [ISOLAMENTO] O TaskManager garante:
    - provider="ollama" → _ai_executor pool (max_workers=1)
    - provider="google" → _generic_executor pool (max_workers conforme config)
    """

    def __init__(self, app_state: Optional[AppState] = None):
        self.app_state = app_state or AppState()
        self.config = ConfigManager()
        self.discovery = AIDiscovery()
        self.governance = AIGovernance(self.app_state)

    def execute_summary(self, video_id: str) -> Dict[str, Any]:
        """
        Pipeline completo de sumarização para um vídeo.
        
        Este método é chamado pelo TaskManager em thread separada.
        NUNCA chama wx ou qualquer componente de UI.
        
        Retorna:
            {"status": "SUCCESS"|"ERROR", "video_id": str, ...}
        """
        start_time = time.perf_counter()

        try:
            # ─── ETAPA 1: Atualiza status ────────────────────
            self.app_state.add_or_update_video({
                "id": video_id,
                "summary_status": "summarizing"
            })
            PubSub.publish('SUMMARY_STARTED', video_id=video_id)

            # ─── ETAPA 2: Busca transcrição ──────────────────
            transcript_data = self.app_state.db_handler.get_transcript(video_id)
            if not transcript_data or not transcript_data.get("full_text"):
                raise AIProviderError(
                    "Transcrição não encontrada. Baixe o vídeo antes de resumir."
                )

            full_text = transcript_data["full_text"]

            # ─── ETAPA 3: Determina provider e modelo ────────
            provider_name = self.config.get("orchestration", "active_provider", "ollama")
            model_name = self._get_model_name(provider_name)
            provider = self._get_provider(provider_name)

            # Verifica disponibilidade
            if not provider.is_available():
                raise AIProviderError(
                    f"Provedor '{provider_name}' não está disponível. "
                    f"Verifique se o serviço está rodando."
                )

            # ─── ETAPA 4: Calcula tokens e decide estratégia ─
            transcript_tokens, _ = count_tokens(full_text)
            context_limit = self.discovery.get_model_context_limit(
                model_name, provider_name
            )
            max_input_tokens = int(context_limit * AI_CONTEXT_USAGE_RATIO)

            logger.info(
                f"Resumo para {video_id}: {transcript_tokens} tokens, "
                f"modelo {model_name} (ctx: {context_limit}), "
                f"limite entrada: {max_input_tokens}"
            )

            # ─── ETAPA 5: Executa resumo ─────────────────────
            if transcript_tokens <= max_input_tokens:
                # CAMINHO A: Chamada única
                result = self._single_call(
                    provider, model_name, full_text
                )
            else:
                # CAMINHO B: Map-Reduce (encapsulado)
                result = self._map_reduce(
                    provider, model_name, full_text, context_limit
                )

            # ─── ETAPA 6: Valida resultado ───────────────────
            summary_text = result.get("summary", "")
            tags = result.get("tags", [])

            if not summary_text:
                raise AIProviderError("Modelo retornou resumo vazio.")

            # Garante que tags é lista de strings
            if not isinstance(tags, list):
                tags = []
            tags = [str(t) for t in tags if t]

            # ─── ETAPA 7: Persiste ───────────────────────────
            # Salva summary na tabela transcripts (mantém full_text original)
            self.app_state.db_handler.save_transcript(
                video_id,
                full_text,
                summary=summary_text
            )

            # Salva tags e status na tabela videos
            self.app_state.add_or_update_video({
                "id": video_id,
                "tags": json.dumps(tags, ensure_ascii=False),
                "summary_status": "summarized"
            })

            elapsed = time.perf_counter() - start_time

            # ─── ETAPA 8: Governança ─────────────────────────
            self._log_usage(
                video_id, model_name, provider_name,
                transcript_tokens, result, elapsed
            )

            # ─── ETAPA 9: Notifica conclusão ─────────────────
            PubSub.publish(
                'SUMMARY_COMPLETED',
                video_id=video_id,
                summary_preview=summary_text[:200],
                tags=tags
            )

            logger.info(
                f"Resumo concluído: {video_id} em {elapsed:.2f}s "
                f"({len(summary_text)} chars, {len(tags)} tags)"
            )

            return {
                "status": "SUCCESS",
                "video_id": video_id,
                "summary": summary_text,
                "tags": tags,
                "elapsed_seconds": round(elapsed, 2),
                "model": model_name,
                "provider": provider_name
            }

        except AIProviderError as e:
            return self._handle_error(video_id, start_time, str(e))

        except Exception as e:
            logger.error(f"Erro inesperado no executor para {video_id}: {e}", exc_info=True)
            return self._handle_error(video_id, start_time, str(e))

    # ─── ESTRATÉGIAS DE SUMARIZAÇÃO ───────────────────────────

    def _single_call(self, provider: AIProvider, model: str,
                     transcript: str) -> Dict[str, Any]:
        """
        Chamada única — transcrição cabe na janela de contexto.
        Caminho mais simples e eficiente.
        """
        prompt = SUMMARY_SYSTEM_PROMPT.format(
            schema=json.dumps(CONTEXTFLOW_JSON_SCHEMA, ensure_ascii=False, indent=2),
            transcript=transcript
        )

        logger.info(f"Estratégia: CHAMADA ÚNICA (prompt: {len(prompt)} chars)")
        return provider.summarize(transcript=transcript, prompt=prompt, model=model)

    def _map_reduce(self, provider: AIProvider, model: str,
                    transcript: str, context_limit: int) -> Dict[str, Any]:
        """
        Map-Reduce — transcrição excede janela de contexto.
        Encapsulado: a UI só vê summarizing → summarized.
        
        Fluxo:
        1. Divide transcrição em chunks (respeitando limites de sentença)
        2. MAP: Cada chunk → extração de pontos-chave
        3. REDUCE: Pontos-chave concatenados → resumo final
        """
        # Calcula tamanho do chunk em caracteres (~4 chars/token)
        chunk_max_tokens = int(context_limit * AI_MAP_CHUNK_RATIO)
        chunk_max_chars = chunk_max_tokens * 4

        # Divide em chunks respeitando sentenças
        chunks = self._chunk_by_sentences(transcript, chunk_max_chars)

        logger.info(
            f"Estratégia: MAP-REDUCE ({len(chunks)} chunks, "
            f"~{chunk_max_tokens} tokens/chunk)"
        )

        # ─── FASE MAP ────────────────────────────────────────
        partial_results = []
        for i, chunk in enumerate(chunks):
            logger.info(f"MAP etapa {i+1}/{len(chunks)}")

            map_prompt = SUMMARY_MAP_PROMPT.format(chunk=chunk)

            try:
                map_result = provider.summarize(
                    transcript=chunk,
                    prompt=map_prompt,
                    model=model
                )
                key_points = map_result.get("key_points", [])
                partial_tags = map_result.get("partial_tags", [])
                partial_results.append({
                    "key_points": key_points,
                    "partial_tags": partial_tags
                })
            except AIProviderError as e:
                logger.warning(f"MAP chunk {i+1} falhou: {e}. Continuando...")
                # Não aborta — tenta os próximos chunks

        if not partial_results:
            raise AIProviderError(
                "Todas as etapas MAP falharam. Verifique o modelo e tente novamente."
            )

        # ─── FASE REDUCE ─────────────────────────────────────
        # Consolida pontos-chave
        all_points = []
        all_tags = []
        for pr in partial_results:
            all_points.extend(pr.get("key_points", []))
            all_tags.extend(pr.get("partial_tags", []))

        partial_text = "\n".join([f"- {p}" for p in all_points])

        reduce_prompt = SUMMARY_REDUCE_PROMPT.format(
            schema=json.dumps(CONTEXTFLOW_JSON_SCHEMA, ensure_ascii=False, indent=2),
            partial_summaries=partial_text
        )

        logger.info(f"REDUCE: consolidando {len(all_points)} pontos-chave")
        final_result = provider.summarize(
            transcript=partial_text,
            prompt=reduce_prompt,
            model=model
        )

        # Merge tags do MAP com tags do REDUCE
        reduce_tags = final_result.get("tags", [])
        merged_tags = list(set(reduce_tags + all_tags))[:8]  # Max 8 tags
        final_result["tags"] = merged_tags

        return final_result

    def _chunk_by_sentences(self, text: str, max_chars: int) -> List[str]:
        """
        Divide texto em chunks respeitando limites de sentença.
        
        Estratégia:
        1. Divide por '. ' (ponto + espaço) para respeitar sentenças
        2. Agrupa sentenças até atingir max_chars
        3. Nunca corta no meio de uma sentença
        """
        # Divide por finais de sentença
        sentences = []
        for part in text.split('. '):
            part = part.strip()
            if part:
                sentences.append(part + '.')

        if not sentences:
            # Fallback: divide por caracteres se não houver sentenças
            return [text[i:i+max_chars] for i in range(0, len(text), max_chars)]

        chunks = []
        current_chunk = []
        current_length = 0

        for sentence in sentences:
            sentence_len = len(sentence)

            if current_length + sentence_len > max_chars and current_chunk:
                # Chunk cheio — salva e começa novo
                chunks.append(' '.join(current_chunk))
                current_chunk = [sentence]
                current_length = sentence_len
            else:
                current_chunk.append(sentence)
                current_length += sentence_len

        # Último chunk
        if current_chunk:
            chunks.append(' '.join(current_chunk))

        # Garantia: pelo menos 1 chunk
        if not chunks:
            chunks = [text[:max_chars]]

        return chunks

    # ─── MÉTODOS AUXILIARES ───────────────────────────────────

    def _get_provider(self, provider_name: str) -> AIProvider:
        """Factory de provedores."""
        if provider_name == "ollama":
            endpoint = self.config.get("ollama", "endpoint", "http://localhost:11434")
            return OllamaProvider(endpoint=endpoint)
        elif provider_name == "google":
            api_key = self.config.get("api_keys", "google", "")
            return GoogleProvider(api_key=api_key)
        raise AIProviderError(f"Provedor '{provider_name}' não implementado.")

    def _get_model_name(self, provider_name: str) -> str:
        """Obtém o modelo configurado para o provedor."""
        if provider_name == "ollama":
            return self.config.get("ollama", "model", "llama3")
        elif provider_name == "google":
            return "gemini-2.0-flash"
        return "unknown"

    def _handle_error(self, video_id: str, start_time: float,
                      error_msg: str) -> Dict[str, Any]:
        """Tratamento centralizado de erros."""
        elapsed = time.perf_counter() - start_time
        logger.error(f"Erro de IA para {video_id}: {error_msg}")

        self.app_state.add_or_update_video({
            "id": video_id,
            "summary_status": "summary_error"
        })

        PubSub.publish(
            'SUMMARY_ERROR',
            video_id=video_id,
            error_msg=error_msg
        )

        return {
            "status": "ERROR",
            "video_id": video_id,
            "error": error_msg,
            "elapsed_seconds": round(elapsed, 2)
        }

    def _log_usage(self, video_id: str, model: str, provider: str,
                   input_tokens: int, result: Dict, elapsed: float):
        """Registra uso no AIGovernance para auditoria financeira."""
        try:
            output_text = json.dumps(result, ensure_ascii=False)
            output_tokens = TokenCounter.count_tokens(output_text)

            gov_data = {
                "video_id": video_id,
                "model_name": model,
                "provider": provider,
                "input_hash": f"summary_{video_id}",
                "prompt_checksum": "global_v1",
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "estimated_cost": 0.0,  # Local = custo zero
                "status": "SUCCESS",
                "total_tti_ms": int(elapsed * 1000),
                "fetch_ms": 0,
                "llm_processing_ms": int(elapsed * 1000),
                "queue_wait_ms": 0,
                "ui_render_ms": 0
            }
            self.governance.log_and_bill(video_id, gov_data)
        except Exception as e:
            logger.warning(f"Falha ao logar uso de IA: {e}")
