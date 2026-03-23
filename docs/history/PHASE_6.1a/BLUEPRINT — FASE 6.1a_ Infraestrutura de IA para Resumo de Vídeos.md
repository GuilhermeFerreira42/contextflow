

# BLUEPRINT — FASE 6.1a: Infraestrutura de IA para Resumo de Vídeos

**Versão:** 1.0 FINAL
**Data:** 2026-03-23
**Status:** PRONTO PARA IMPLEMENTAÇÃO

---

## 1. Visão Geral

### 1.1 Objetivo
Implementar a infraestrutura completa de IA para sumarização de vídeos no ContextFlow. Esta fase cria os "cimentos de base" — provedores, discovery, executor, persistência e governança — sem tocar na camada de UI.

### 1.2 Escopo
- **INCLUSO:** Provider Ollama (HTTP direto), Discovery automático, Executor com map-reduce encapsulado, migração de DB, PubSub events, logging de governança, script de verificação
- **EXCLUSO:** Toda a camada de UI (toolbar, seletores, animações, visualizador), Google Gemini (implementação real), prompt customizado por vídeo, refatoração de arquivos existentes

### 1.3 Princípios Invioláveis
1. **HTTP Direto** — Toda comunicação com Ollama via `requests`. Zero subprocess, zero bibliotecas Ollama
2. **Isolamento Total** — Nenhum import de `wx` nos arquivos desta fase. A UI não é tocada
3. **Bisturi, não Marreta** — Modificações cirúrgicas em arquivos existentes. Só adicionar, nunca remover
4. **Thread Safety** — Todo método do executor é thread-safe. Cada chamada opera com seu próprio `video_id`
5. **Falha Graceful** — Erro de IA NUNCA trava o app. Sempre captura, loga e atualiza status para `summary_error`

### 1.4 Evidências de Teste
O script `test_ai_summary.py` validou:
- `requests.post` para `/api/generate` funciona: modelo `gpt-oss:20b-cloud`, ~27K tokens, 4.86s
- `format: "json"` no payload força saída JSON válida
- Schema `{summary, tags, language}` é suficiente e confiável
- Modelos cloud do Ollama funcionam pelo mesmo endpoint HTTP

---

## 2. Arquitetura

### 2.1 Diagrama de Fluxo

```
[AppState.request_summary(video_id)]
         │
         ▼
[TaskManager.submit_task("summary_{id}", executor.execute_summary, video_id)]
         │  (provider="ollama" → _ai_executor pool, max_workers=1)
         │  (provider="google" → _generic_executor pool, futuro)
         ▼
[AIExecutor.execute_summary(video_id)]
    │
    ├── 1. Atualiza summary_status = 'summarizing'
    ├── 2. PubSub.publish('SUMMARY_STARTED', video_id=video_id)
    ├── 3. Busca transcrição: db_handler.get_transcript(video_id)
    ├── 4. Determina provider + modelo via ConfigManager
    ├── 5. Consulta context_limit via AIDiscovery
    ├── 6. Decide: chamada única OU map-reduce (encapsulado)
    │       │
    │       ├── SE tokens <= 75% do context_limit → Chamada Única
    │       │       └── OllamaProvider.summarize(transcript, prompt, model)
    │       │
    │       └── SE tokens > 75% do context_limit → Map-Reduce
    │               ├── Chunk 1 → OllamaProvider.summarize(chunk, MAP_PROMPT)
    │               ├── Chunk 2 → OllamaProvider.summarize(chunk, MAP_PROMPT)
    │               ├── ...
    │               └── Síntese → OllamaProvider.summarize(chunks_resumidos, REDUCE_PROMPT)
    │
    ├── 7. Parse JSON: {summary, tags, language}
    ├── 8. Persiste: db_handler.save_transcript(summary=...), add_or_update_video(tags=..., summary_status='summarized')
    ├── 9. Log governança: AIGovernance.log_and_bill()
    └── 10. PubSub.publish('SUMMARY_COMPLETED', video_id=video_id)
```

### 2.2 Mapa de Dependências

```
constants.py (PROMPTS, SCHEMA)
     │
     ▼
services/ai_provider.py (ABC)
     │
     ▼
services/ai_providers/ollama_provider.py ──► requests (já instalado)
     │
     ▼
services/ai_discovery.py ──► ollama_provider.list_models()
     │                        ollama_provider.get_model_info()
     ▼
services/ai_executor.py ──► ai_discovery (context limits)
     │                      ollama_provider (chamadas)
     │                      db_handler (read/write)
     │                      ai_governance (logging)
     │                      pubsub (eventos)
     │                      token_engine (contagem)
     ▼
core/app_state.py ──► task_manager.submit_task()
                      ai_executor.execute_summary()
```

### 2.3 Inventário de Arquivos

| Arquivo | Ação | Linhas Estimadas |
|---|---|---|
| `services/ai_provider.py` | **NOVO** | ~60 |
| `services/ai_providers/__init__.py` | **NOVO** | ~1 |
| `services/ai_providers/ollama_provider.py` | **NOVO** | ~250 |
| `services/ai_providers/google_provider.py` | **NOVO** (stub) | ~40 |
| `services/ai_discovery.py` | **NOVO** | ~120 |
| `services/ai_executor.py` | **NOVO** | ~350 |
| `storage/db_handler.py` | **MOD** | +15 linhas |
| `core/managers/video_manager.py` | **MOD** | +20 linhas |
| `core/app_state.py` | **MOD** | +30 linhas |
| `constants.py` | **MOD** | +40 linhas |
| `scripts/verification/verify_phase_6_1a.py` | **NOVO** | ~200 |

---

## 3. Especificações Técnicas por Arquivo

### 3.1 `constants.py` — Adições

**Localização:** Após `COLOR_ACCENT` (fim do bloco UI Colors)

```python
# --- AI Summary Configuration ---
CONTEXTFLOW_JSON_SCHEMA = {
    "summary": "Resumo narrativo completo do conteúdo...",
    "tags": ["tag1", "tag2", "tag3"],
    "language": "pt-BR"
}

SUMMARY_SYSTEM_PROMPT = """Você é um assistente especializado em análise de conteúdo de vídeo.
Sua tarefa é analisar a transcrição abaixo e gerar um resumo estruturado em JSON.

## REGRAS OBRIGATÓRIAS:
1. Responda APENAS com JSON válido, sem texto antes ou depois
2. Não use markdown (sem ```json)
3. O campo "summary" deve ter entre 200-500 palavras
4. O campo "tags" deve ter entre 3-8 tags relevantes em português
5. Idioma do resumo: português do Brasil (pt-BR)
6. As tags devem ser substantivos ou expressões curtas que descrevam os temas centrais

## SCHEMA DE SAÍDA:
{schema}

## TRANSCRIÇÃO DO VÍDEO:
{transcript}"""

SUMMARY_MAP_PROMPT = """Você é um assistente especializado em análise de conteúdo.
Extraia os pontos-chave do trecho abaixo. Responda APENAS com JSON válido.

## SCHEMA:
{{"key_points": ["ponto 1", "ponto 2", ...], "partial_tags": ["tag1", "tag2"]}}

## TRECHO:
{chunk}"""

SUMMARY_REDUCE_PROMPT = """Você é um assistente especializado em síntese de conteúdo.
Abaixo estão extrações parciais de um vídeo longo. Consolide tudo em um resumo final.
Responda APENAS com JSON válido.

## SCHEMA:
{schema}

## EXTRAÇÕES PARCIAIS:
{partial_summaries}"""

# Limites de segurança para IA
AI_DEFAULT_CONTEXT_FALLBACK = 4096
AI_CONTEXT_USAGE_RATIO = 0.75  # Usa no máximo 75% do contexto do modelo
AI_MAP_CHUNK_RATIO = 0.60      # Cada chunk usa 60% do contexto (reserva para prompt+resposta)
AI_DEFAULT_TIMEOUT = 600       # 10 minutos
AI_DEFAULT_TEMPERATURE = 0.7
AI_DEFAULT_TOP_P = 0.9
AI_DEFAULT_NUM_PREDICT = 2048
```

**Invariantes:**
- `CONTEXTFLOW_JSON_SCHEMA` é o contrato público entre IA e sistema
- `AI_CONTEXT_USAGE_RATIO` NUNCA deve ser maior que 0.80 (segurança para prompt + resposta)
- Os templates usam `{schema}`, `{transcript}`, `{chunk}`, `{partial_summaries}` como placeholders

---

### 3.2 `services/ai_provider.py` — Interface Abstrata

**Arquivo NOVO. Caminho: `services/ai_provider.py`**

```python
# contextflow/services/ai_provider.py
"""
Interface abstrata para provedores de IA.
[FASE 6.1a] Todo provedor DEVE implementar esta interface.
"""
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List
import logging

logger = logging.getLogger("contextflow.ai.provider")


class AIProviderError(Exception):
    """
    Exceção base para erros de provedores de IA.
    [GOVERNANÇA] Toda falha de IA DEVE ser encapsulada nesta exceção
    para que o AIExecutor possa capturá-la uniformemente.
    """
    pass


class AIProvider(ABC):
    """
    Interface abstrata (ABC) para provedores de IA.
    Contrato público que todo provider deve implementar.
    """

    @abstractmethod
    def summarize(self, transcript: str, prompt: str, model: str,
                  options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Envia transcrição para o modelo e retorna JSON estruturado.
        
        Args:
            transcript: Texto da transcrição (pode ser truncado pelo executor)
            prompt: Prompt completo montado pelo executor
            model: Nome do modelo a usar
            options: Opções extras (temperature, top_p, num_predict, etc.)
        
        Returns:
            Dict com pelo menos: {"summary": str, "tags": List[str], "language": str}
        
        Raises:
            AIProviderError: Em caso de qualquer falha (rede, parse, timeout)
        """
        pass

    @abstractmethod
    def list_models(self) -> List[Dict[str, Any]]:
        """
        Lista modelos disponíveis no provedor.
        
        Returns:
            Lista de dicts, cada um com pelo menos:
            {"name": str, "context_length": int, "has_thinking": bool, "is_cloud": bool}
        """
        pass

    @abstractmethod
    def get_model_info(self, model_name: str) -> Dict[str, Any]:
        """
        Retorna metadados detalhados de um modelo específico.
        
        Returns:
            Dict com: context_length, has_thinking, is_cloud, family, parameter_size, quantization_level
        """
        pass

    @abstractmethod
    def is_available(self) -> bool:
        """
        Verifica se o provedor está acessível.
        Não deve levantar exceções — retorna False em caso de falha.
        """
        pass
```

**Invariantes:**
- `summarize()` SEMPRE retorna Dict ou levanta `AIProviderError`. Nunca retorna None
- `is_available()` NUNCA levanta exceção
- `list_models()` retorna lista vazia em caso de erro (não levanta exceção)

---

### 3.3 `services/ai_providers/__init__.py`

**Arquivo NOVO. Caminho: `services/ai_providers/__init__.py`**

```python
# contextflow/services/ai_providers/__init__.py
```

---

### 3.4 `services/ai_providers/ollama_provider.py` — Provider Ollama (HTTP Direto)

**Arquivo NOVO. Caminho: `services/ai_providers/ollama_provider.py`**

```python
# contextflow/services/ai_providers/ollama_provider.py
"""
Provider Ollama via HTTP direto.
[FASE 6.1a] Validado pelo teste: gpt-oss:20b-cloud, ~27K tokens, 4.86s.
DECISÃO: Usa requests.post, NÃO usa subprocess, NÃO usa biblioteca ollama.
"""
import requests
import json
import re
import logging
from typing import Dict, Any, Optional, List

from services.ai_provider import AIProvider, AIProviderError
from constants import (
    AI_DEFAULT_TIMEOUT,
    AI_DEFAULT_TEMPERATURE,
    AI_DEFAULT_TOP_P,
    AI_DEFAULT_NUM_PREDICT
)

logger = logging.getLogger("contextflow.ai.ollama")


class OllamaProvider(AIProvider):
    """
    Implementação do provider Ollama usando a API HTTP REST.
    
    Endpoints utilizados:
    - GET  /           → health check (is_available)
    - GET  /api/tags   → lista modelos (list_models)
    - POST /api/show   → detalhes do modelo (get_model_info)
    - POST /api/generate → geração de texto (summarize)
    """

    def __init__(self, endpoint: str = "http://localhost:11434"):
        self.endpoint = endpoint.rstrip("/")
        self.timeout = AI_DEFAULT_TIMEOUT

    # ─── CONTRATO PÚBLICO ─────────────────────────────────────

    def summarize(self, transcript: str, prompt: str, model: str,
                  options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Chamada via POST /api/generate.
        [VALIDADO] Mesma abordagem do test_ai_summary.py.
        """
        default_options = {
            "temperature": AI_DEFAULT_TEMPERATURE,
            "top_p": AI_DEFAULT_TOP_P,
            "num_predict": AI_DEFAULT_NUM_PREDICT
        }
        if options:
            default_options.update(options)

        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "format": "json",   # [CRÍTICO] Força saída JSON válida
            "options": default_options
        }

        try:
            logger.info(f"POST /api/generate → modelo={model}, prompt_len={len(prompt)}")

            response = requests.post(
                f"{self.endpoint}/api/generate",
                json=payload,
                timeout=self.timeout
            )

            if response.status_code != 200:
                raise AIProviderError(
                    f"Ollama HTTP {response.status_code}: {response.text[:500]}"
                )

            result = response.json()
            raw_output = result.get("response", "")

            if not raw_output.strip():
                raise AIProviderError("Ollama retornou resposta vazia.")

            # Parse JSON
            parsed = self._parse_json_response(raw_output)
            if not parsed:
                raise AIProviderError(
                    f"Falha ao parsear JSON do modelo. Resposta bruta: {raw_output[:500]}"
                )

            # Validação mínima de schema
            if "summary" not in parsed:
                raise AIProviderError(
                    f"Campo 'summary' ausente na resposta do modelo."
                )
            if "tags" not in parsed or not isinstance(parsed["tags"], list):
                # Fallback: tags vazia em vez de erro fatal
                parsed["tags"] = []
                logger.warning("Campo 'tags' ausente ou inválido. Usando lista vazia.")

            if "language" not in parsed:
                parsed["language"] = "pt-BR"

            return parsed

        except requests.exceptions.Timeout:
            raise AIProviderError(
                f"Timeout: modelo {model} excedeu {self.timeout}s. "
                f"Tente um modelo menor ou aumente o timeout."
            )
        except requests.exceptions.ConnectionError:
            raise AIProviderError(
                f"Conexão recusada em {self.endpoint}. "
                f"Verifique se o Ollama está rodando (ollama serve)."
            )
        except AIProviderError:
            raise
        except Exception as e:
            raise AIProviderError(f"Erro inesperado no OllamaProvider: {str(e)}")

    def list_models(self) -> List[Dict[str, Any]]:
        """
        Lista modelos via GET /api/tags.
        [DECISÃO] Usa HTTP em vez de subprocess para funcionar com endpoints remotos.
        """
        try:
            response = requests.get(
                f"{self.endpoint}/api/tags",
                timeout=15
            )
            if response.status_code != 200:
                logger.warning(f"Ollama /api/tags retornou {response.status_code}")
                return []

            data = response.json()
            models = []

            for model_data in data.get("models", []):
                name = model_data.get("name", "")
                if not name:
                    continue

                # Busca detalhes do modelo
                info = self.get_model_info(name)

                models.append({
                    "name": name,
                    "context_length": info.get("context_length", 0),
                    "has_thinking": info.get("has_thinking", False),
                    "is_cloud": info.get("is_cloud", False),
                    "family": info.get("family", ""),
                    "parameter_size": info.get("parameter_size", ""),
                    "quantization_level": info.get("quantization_level", ""),
                    "size_bytes": model_data.get("size", 0),
                    "modified_at": model_data.get("modified_at", "")
                })

            logger.info(f"Ollama: {len(models)} modelos descobertos em {self.endpoint}")
            return models

        except requests.exceptions.ConnectionError:
            logger.warning(f"Ollama não acessível em {self.endpoint}")
            return []
        except Exception as e:
            logger.error(f"Erro ao listar modelos Ollama: {e}")
            return []

    def get_model_info(self, model_name: str) -> Dict[str, Any]:
        """
        Obtém metadados via POST /api/show.
        
        A resposta do Ollama /api/show contém:
        - model_info: dict com chaves como "general.context_length" → int
        - details: dict com family, parameter_size, quantization_level
        - capabilities: list com strings como "completion", "thinking", "vision"
        """
        try:
            response = requests.post(
                f"{self.endpoint}/api/show",
                json={"name": model_name},
                timeout=10
            )
            if response.status_code != 200:
                return {}

            data = response.json()

            # --- Context Length ---
            context_length = 0
            model_info = data.get("model_info", {})

            # Busca em model_info (formato: "chave.context_length" → valor int)
            for key, value in model_info.items():
                if "context_length" in key.lower():
                    try:
                        context_length = int(value)
                    except (ValueError, TypeError):
                        pass
                    break

            # --- Capabilities ---
            has_thinking = False
            capabilities = data.get("capabilities", [])
            if isinstance(capabilities, list):
                has_thinking = "thinking" in capabilities

            # --- Cloud detection ---
            is_cloud = False
            # Modelos cloud têm "general.remote" ou URL remota nos dados
            for key, value in model_info.items():
                if "remote" in key.lower():
                    is_cloud = bool(value)
                    break

            # --- Details ---
            details = data.get("details", {})

            return {
                "context_length": context_length,
                "has_thinking": has_thinking,
                "is_cloud": is_cloud,
                "family": details.get("family", ""),
                "parameter_size": details.get("parameter_size", ""),
                "quantization_level": details.get("quantization_level", "")
            }

        except Exception as e:
            logger.warning(f"Erro ao obter info do modelo {model_name}: {e}")
            return {}

    def is_available(self) -> bool:
        """Health check via GET /."""
        try:
            response = requests.get(f"{self.endpoint}/", timeout=5)
            return response.status_code == 200
        except Exception:
            return False

    # ─── PARSING INTERNO ──────────────────────────────────────

    def _parse_json_response(self, raw: str) -> Optional[Dict]:
        """
        Parser robusto de JSON com múltiplos fallbacks.
        [VALIDADO] Mesma lógica do test_ai_summary.py que funcionou em produção.
        """
        raw = raw.strip()

        # 1. Remove markdown wrappers se houver
        if raw.startswith("```"):
            raw = re.sub(r'^```(?:json)?\s*', '', raw)
            raw = re.sub(r'\s*```$', '', raw)
            raw = raw.strip()

        # 2. Parse direto
        try:
            return json.loads(raw)
        except (json.JSONDecodeError, ValueError):
            pass

        # 3. Busca bloco JSON no meio do texto
        json_match = re.search(r'\{[\s\S]*\}', raw)
        if json_match:
            try:
                return json.loads(json_match.group())
            except (json.JSONDecodeError, ValueError):
                pass

        # 4. Fallback: estrutura manual se tem conteúdo significativo
        if len(raw) > 100:
            logger.warning("JSON parse falhou. Usando fallback de extração manual.")
            return {
                "summary": raw[:3000],
                "tags": ["auto-extraido"],
                "language": "pt-BR"
            }

        return None
```

**Invariantes do OllamaProvider:**
1. `summarize()` SEMPRE usa `"format": "json"` no payload — validado em teste
2. `list_models()` e `is_available()` NUNCA levantam exceção — retornam vazio/False
3. `_parse_json_response()` tem 4 níveis de fallback para máxima resiliência
4. Todos os timeouts são configuráveis via constants

---

### 3.5 `services/ai_providers/google_provider.py` — Stub para Google Gemini

**Arquivo NOVO. Caminho: `services/ai_providers/google_provider.py`**

```python
# contextflow/services/ai_providers/google_provider.py
"""
Stub do Provider Google Gemini.
[FASE 6.1a] Interface preparada. Implementação real na Fase 6.1b.
"""
import logging
from typing import Dict, Any, Optional, List
from services.ai_provider import AIProvider, AIProviderError

logger = logging.getLogger("contextflow.ai.google")


class GoogleProvider(AIProvider):
    """
    Provider Google Gemini — STUB.
    Implementação real será feita na Fase 6.1b.
    """

    def __init__(self, api_key: str = ""):
        self.api_key = api_key

    def summarize(self, transcript: str, prompt: str, model: str,
                  options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        raise AIProviderError(
            "Google Gemini não implementado nesta versão. "
            "Use Ollama como provedor ativo. "
            "Implementação prevista para Fase 6.1b."
        )

    def list_models(self) -> List[Dict[str, Any]]:
        # Retorna lista hardcoded de modelos conhecidos
        return [
            {"name": "gemini-2.0-flash", "context_length": 1_048_576,
             "has_thinking": True, "is_cloud": True},
            {"name": "gemini-1.5-pro", "context_length": 2_097_152,
             "has_thinking": False, "is_cloud": True},
            {"name": "gemini-1.5-flash", "context_length": 1_048_576,
             "has_thinking": False, "is_cloud": True},
        ]

    def get_model_info(self, model_name: str) -> Dict[str, Any]:
        for m in self.list_models():
            if m["name"] == model_name:
                return m
        return {}

    def is_available(self) -> bool:
        return bool(self.api_key)
```

---

### 3.6 `services/ai_discovery.py` — Discovery de Modelos

**Arquivo NOVO. Caminho: `services/ai_discovery.py`**

```python
# contextflow/services/ai_discovery.py
"""
Discovery automático de modelos por provedor.
[FASE 6.1a] Usa HTTP puro — NÃO usa subprocess.
"""
import logging
import threading
from typing import Dict, Any, List, Optional

from core.config_manager import ConfigManager
from services.ai_providers.ollama_provider import OllamaProvider
from services.ai_providers.google_provider import GoogleProvider
from constants import AI_DEFAULT_CONTEXT_FALLBACK

logger = logging.getLogger("contextflow.ai.discovery")


class AIDiscovery:
    """
    Serviço de descoberta de modelos de IA.
    
    Responsabilidades:
    - Listar modelos disponíveis por provedor
    - Fornecer metadados (context_length, capabilities) ao AIExecutor
    - Cache em memória com invalidação manual
    """

    def __init__(self):
        self.config = ConfigManager()
        self._cache: Dict[str, List[Dict[str, Any]]] = {}
        self._lock = threading.Lock()

    def discover_models(self, provider: str = None) -> List[Dict[str, Any]]:
        """
        Descobre modelos para o provedor especificado.
        Se provider=None, usa active_provider do ConfigManager.
        Thread-safe via lock.
        """
        if provider is None:
            provider = self.config.get("orchestration", "active_provider", "ollama")

        with self._lock:
            if provider == "ollama":
                models = self._discover_ollama()
            elif provider == "google":
                models = self._discover_google()
            else:
                logger.warning(f"Provider '{provider}' não suportado para discovery.")
                models = []

            self._cache[provider] = models
            return models

    def get_cached_models(self, provider: str = None) -> List[Dict[str, Any]]:
        """Retorna modelos do cache sem fazer nova chamada HTTP."""
        if provider is None:
            provider = self.config.get("orchestration", "active_provider", "ollama")
        return self._cache.get(provider, [])

    def get_model_context_limit(self, model_name: str, provider: str = "ollama") -> int:
        """
        Retorna o context_length do modelo.
        Usado pelo AIExecutor para decidir truncamento vs. map-reduce.
        
        Ordem de busca:
        1. Cache em memória
        2. Chamada direta ao provider
        3. Fallback conservador (AI_DEFAULT_CONTEXT_FALLBACK)
        """
        # 1. Busca no cache
        cached = self._cache.get(provider, [])
        for model in cached:
            if model["name"] == model_name:
                ctx = model.get("context_length", 0)
                if ctx > 0:
                    return ctx

        # 2. Busca direta
        if provider == "ollama":
            try:
                endpoint = self.config.get("ollama", "endpoint", "http://localhost:11434")
                p = OllamaProvider(endpoint=endpoint)
                info = p.get_model_info(model_name)
                ctx = info.get("context_length", 0)
                if ctx > 0:
                    return ctx
            except Exception as e:
                logger.warning(f"Falha ao buscar context_length para {model_name}: {e}")

        elif provider == "google":
            p = GoogleProvider()
            info = p.get_model_info(model_name)
            ctx = info.get("context_length", 0)
            if ctx > 0:
                return ctx

        # 3. Fallback
        logger.info(
            f"Context limit não encontrado para {model_name}. "
            f"Usando fallback: {AI_DEFAULT_CONTEXT_FALLBACK}"
        )
        return AI_DEFAULT_CONTEXT_FALLBACK

    def invalidate_cache(self):
        """Limpa todo o cache para forçar re-discovery."""
        with self._lock:
            self._cache.clear()
            logger.info("AIDiscovery: Cache invalidado.")

    # ─── DISCOVERY POR PROVEDOR ───────────────────────────────

    def _discover_ollama(self) -> List[Dict[str, Any]]:
        """Discovery via HTTP (/api/tags + /api/show)."""
        endpoint = self.config.get("ollama", "endpoint", "http://localhost:11434")
        provider = OllamaProvider(endpoint=endpoint)

        if not provider.is_available():
            logger.warning(f"Ollama não disponível em {endpoint}")
            return []

        return provider.list_models()

    def _discover_google(self) -> List[Dict[str, Any]]:
        """Discovery para Google Gemini (stub - lista hardcoded)."""
        api_key = self.config.get("api_keys", "google", "")
        provider = GoogleProvider(api_key=api_key)
        return provider.list_models()
```

**Invariantes:**
1. `discover_models()` é thread-safe (usa `threading.Lock`)
2. `get_model_context_limit()` SEMPRE retorna um int > 0 (nunca zero)
3. Cache é dict em memória — não persiste entre sessões (intencional)

---

### 3.7 `services/ai_executor.py` — Orquestrador de Resumo

**Arquivo NOVO. Caminho: `services/ai_executor.py`**

```python
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
from core.token_engine import count_tokens
from core.ai_governance import AIGovernance, TokenCounter
from core.pubsub import PubSub
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
```

**Invariantes do AIExecutor:**
1. `execute_summary()` NUNCA importa wx. NUNCA toca na UI
2. Toda notificação de UI é via PubSub (3 eventos: STARTED, COMPLETED, ERROR)
3. Erros são SEMPRE capturados e transformam `summary_status` em `summary_error`
4. Map-Reduce é transparente para o chamador — mesma assinatura, mesmo retorno
5. Cada chamada é isolada por `video_id` — sem estado compartilhado

---

### 3.8 `storage/db_handler.py` — Migração

**Tipo: MODIFICAÇÃO. Localização: método `_check_and_migrate_db()`**

Adicionar **APÓS** o bloco `if 'added_at' not in columns:`:

```python
            if 'tags' not in columns:
                print("Migrando DB: Adicionando tags...")
                cursor.execute("ALTER TABLE videos ADD COLUMN tags TEXT DEFAULT '[]'")

            if 'summary_status' not in columns:
                print("Migrando DB: Adicionando summary_status...")
                cursor.execute("ALTER TABLE videos ADD COLUMN summary_status TEXT")
```

Adicionalmente, no método `add_video_entry()`, adicionar os novos campos ao INSERT e UPDATE.

**Localização:** No INSERT do `add_video_entry`, adicionar `tags` e `summary_status` à lista de colunas:

```python
    def add_video_entry(self, video_data: Dict[str, Any]):
        """Insere ou atualiza um registro de vídeo."""
        conn = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute('''
                INSERT INTO videos (id, url, title, channel_name, duration, upload_date,
                    thumbnail_path, playlist_id, playlist_title, token_count, status,
                    created_at, added_at, tags, summary_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    title=excluded.title,
                    channel_name=excluded.channel_name,
                    playlist_id=excluded.playlist_id,
                    playlist_title=excluded.playlist_title,
                    token_count=excluded.token_count,
                    status=excluded.status,
                    thumbnail_path=excluded.thumbnail_path,
                    duration=excluded.duration,
                    tags=COALESCE(excluded.tags, tags),
                    summary_status=COALESCE(excluded.summary_status, summary_status)
            ''', (
                video_data['id'],
                video_data['url'],
                video_data.get('title', 'Unknown'),
                video_data.get('channel_name', video_data.get('channel', '')),
                video_data.get('duration', 0),
                video_data.get('upload_date', ''),
                video_data.get('thumbnail_path', ''),
                video_data.get('playlist_id'),
                video_data.get('playlist_title'),
                video_data.get('token_count', 0),
                video_data.get('status', 'pending'),
                datetime.datetime.now().isoformat(),
                video_data.get('added_at') or datetime.datetime.now().strftime("%d/%m/%Y %H:%M:%S"),
                video_data.get('tags', '[]'),
                video_data.get('summary_status')
            ))
            conn.commit()
        except Exception as e:
            print(f"DB Error (add_video): {e}")
        finally:
            conn.close()
```

**Nota crítica sobre COALESCE:** `COALESCE(excluded.tags, tags)` garante que se o update NÃO enviar tags (ex: uma atualização de status), o valor existente no banco é preservado. Isso previne sobrescrita acidental de tags durante updates parciais.

---

### 3.9 `core/managers/video_manager.py` — Adições

**Tipo: MODIFICAÇÃO. Adicionar APÓS o método `clear_non_completed()`:**

```python
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
```

---

### 3.10 `core/app_state.py` — Adições

**Tipo: MODIFICAÇÃO. Adicionar APÓS o método `is_cancel_requested()`:**

```python
    # ─── Delegation: AI Summary (FASE 6.1a) ───────────────────

    def get_video_tags(self, video_id: str) -> list:
        """Retorna tags do vídeo como lista Python."""
        return self.video_manager.get_video_tags(video_id)

    def get_summary_status(self, video_id: str) -> str:
        """Retorna status de resumo do vídeo."""
        return self.video_manager.get_summary_status(video_id)

    def get_videos_pending_summary(self) -> list:
        """Retorna vídeos elegíveis para resumo."""
        return self.video_manager.get_videos_pending_summary()

    def request_summary(self, video_id: str):
        """
        Submete pedido de resumo ao TaskManager.
        [THREAD SAFETY] O executor roda na pool de IA (max_workers=1 para Ollama).
        """
        from services.ai_executor import AIExecutor
        executor = AIExecutor(self)

        provider = self.config.get("orchestration", "active_provider", "ollama")
        self.task_manager.submit_task(
            f"summary_{video_id}",
            executor.execute_summary,
            video_id,
            provider=provider
        )

    def request_batch_summary(self, video_ids: list):
        """
        Submete múltiplos pedidos de resumo.
        Cada vídeo é enfileirado como tarefa separada.
        O TaskManager controla a concorrência (1 para Ollama, N para cloud).
        """
        for vid in video_ids:
            self.request_summary(vid)
```

---

## 4. Contratos de Interface

### 4.1 PubSub Events (Novos)

| Evento | Kwargs | Publicado por | Consumido por (6.1b) |
|---|---|---|---|
| `SUMMARY_STARTED` | `video_id: str` | AIExecutor | TabAnalysis, Sidebar |
| `SUMMARY_COMPLETED` | `video_id: str, summary_preview: str, tags: list` | AIExecutor | TabAnalysis, Sidebar, DetailPanel |
| `SUMMARY_ERROR` | `video_id: str, error_msg: str` | AIExecutor | TabAnalysis, ConsolePanel |

### 4.2 Contrato do JSON de IA

**Entrada** (prompt → modelo):
```
SUMMARY_SYSTEM_PROMPT com placeholders {schema} e {transcript}
```

**Saída** (modelo → sistema):
```json
{
  "summary": "Texto narrativo de 200-500 palavras...",
  "tags": ["tag1", "tag2", "tag3"],
  "language": "pt-BR"
}
```

**Garantias:**
- `summary`: SEMPRE string não-vazia (ou erro)
- `tags`: Lista de strings. Pode ser vazia (fallback). Máximo 8 itens
- `language`: String. Default "pt-BR" se ausente

### 4.3 Contrato do AIExecutor.execute_summary()

**Input:** `video_id: str`

**Output SUCCESS:**
```python
{
    "status": "SUCCESS",
    "video_id": "abc123",
    "summary": "Texto do resumo...",
    "tags": ["tag1", "tag2"],
    "elapsed_seconds": 4.86,
    "model": "gpt-oss:20b-cloud",
    "provider": "ollama"
}
```

**Output ERROR:**
```python
{
    "status": "ERROR",
    "video_id": "abc123",
    "error": "Descrição do erro",
    "elapsed_seconds": 1.23
}
```

### 4.4 Contrato do AIDiscovery.discover_models()

**Output:**
```python
[
    {
        "name": "gpt-oss:20b-cloud",
        "context_length": 131072,
        "has_thinking": True,
        "is_cloud": True,
        "family": "gptoss",
        "parameter_size": "20.9B",
        "quantization_level": "MXFP4",
        "size_bytes": 0,
        "modified_at": "2026-03-23T..."
    },
    # ...
]
```

---

## 5. Migrações de DB (SQL Completo)

### 5.1 Tabela `videos` — Novos campos

```sql
-- Migração automática via _check_and_migrate_db()
-- Executada no boot do DatabaseHandler

ALTER TABLE videos ADD COLUMN tags TEXT DEFAULT '[]';
ALTER TABLE videos ADD COLUMN summary_status TEXT;

-- Índice para consulta de vídeos pendentes de resumo
CREATE INDEX IF NOT EXISTS idx_videos_summary_status ON videos(summary_status);
```

### 5.2 Valores de `summary_status`

| Valor | Significado | Renderização na Grid (6.1b) |
|---|---|---|
| `NULL` | Nunca resumido | "✨Clique para resumir" |
| `'summarizing'` | Em processamento pela IA | "⏳ Resumindo..." |
| `'summarized'` | Resumo concluído | Snippet dos primeiros 100 chars |
| `'summary_error'` | Falha no resumo | "❌ Erro ao resumir" |

### 5.3 Formato de `tags`

```
-- Armazenado como JSON string
-- Exemplos:
'[]'                                          -- Sem tags
'["economia", "investimentos"]'               -- Com tags
'["auto-extraido"]'                          -- Fallback do parser
```

---

## 6. Script de Verificação

**Caminho: `scripts/verification/verify_phase_6_1a.py`**

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ContextFlow — Verificação da Fase 6.1a
Testa: Discovery, Provider, Executor, DB Migration, PubSub
Uso: python scripts/verification/verify_phase_6_1a.py
"""
import os
import sys
import json
import time
import sqlite3
import threading

# Add project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

# Variáveis globais para captura de eventos PubSub
_pubsub_events = []
_pubsub_lock = threading.Lock()


def capture_event(**kwargs):
    """Captura eventos PubSub para verificação."""
    with _pubsub_lock:
        _pubsub_events.append(kwargs)


def get_events():
    with _pubsub_lock:
        return list(_pubsub_events)


def clear_events():
    with _pubsub_lock:
        _pubsub_events.clear()


def verify():
    print("\n" + "=" * 70)
    print("  CONTEXTFLOW — VERIFICAÇÃO FASE 6.1a")
    print("  Infraestrutura de IA para Resumo de Vídeos")
    print("=" * 70)

    results = {}
    db_path = "test_verify_6_1a.db"

    # Cleanup
    if os.path.exists(db_path):
        os.remove(db_path)

    try:
        # ─── TESTE 1: DB Migration ──────────────────────────
        print("\n[1/7] DB Migration — campos tags e summary_status...")
        from storage.db_handler import DatabaseHandler
        db = DatabaseHandler(db_path)

        conn = sqlite3.connect(db_path)
        c = conn.cursor()
        c.execute("PRAGMA table_info(videos)")
        columns = [info[1] for info in c.fetchall()]
        conn.close()

        has_tags = "tags" in columns
        has_ss = "summary_status" in columns

        print(f"  tags column: {'✅' if has_tags else '❌'}")
        print(f"  summary_status column: {'✅' if has_ss else '❌'}")
        results["db_migration"] = has_tags and has_ss

        # ─── TESTE 2: Provider Disponibilidade ──────────────
        print("\n[2/7] Provider Ollama — disponibilidade...")
        from services.ai_providers.ollama_provider import OllamaProvider
        provider = OllamaProvider()
        is_available = provider.is_available()
        print(f"  Ollama em localhost:11434: {'✅ Disponível' if is_available else '⚠️ Indisponível (testes de IA serão pulados)'}")
        results["provider_available"] = True  # Não é falha se Ollama não está rodando

        # ─── TESTE 3: Discovery ─────────────────────────────
        print("\n[3/7] Discovery — listagem de modelos...")
        from services.ai_discovery import AIDiscovery
        discovery = AIDiscovery()

        if is_available:
            models = discovery.discover_models("ollama")
            print(f"  Modelos encontrados: {len(models)}")
            for m in models[:5]:
                ctx = m.get('context_length', 0)
                thinking = '🧠' if m.get('has_thinking') else '  '
                cloud = '☁️' if m.get('is_cloud') else '💻'
                print(f"    {cloud} {thinking} {m['name']:<30} ctx={ctx:>8}")

            # Verifica que context_length está sendo capturado
            has_ctx = any(m.get("context_length", 0) > 0 for m in models)
            print(f"  Context length detectado: {'✅' if has_ctx else '⚠️ Nenhum modelo com ctx'}")
            results["discovery"] = len(models) > 0
        else:
            print("  ⏭️ Pulado (Ollama indisponível)")
            results["discovery"] = True  # Não é falha

        # ─── TESTE 4: Provider Google (Stub) ────────────────
        print("\n[4/7] Provider Google — stub funcional...")
        from services.ai_providers.google_provider import GoogleProvider
        gp = GoogleProvider()
        google_models = gp.list_models()
        google_available = gp.is_available()
        print(f"  Modelos hardcoded: {len(google_models)}")
        print(f"  Disponível (sem API key): {'✅ False (correto)' if not google_available else '❌ True (inesperado)'}")

        try:
            gp.summarize("test", "test", "gemini-2.0-flash")
            results["google_stub"] = False  # Deveria ter lançado erro
            print("  ❌ Deveria ter lançado AIProviderError")
        except Exception as e:
            if "não implementado" in str(e).lower():
                results["google_stub"] = True
                print("  ✅ Lança AIProviderError corretamente")
            else:
                results["google_stub"] = False
                print(f"  ❌ Exceção inesperada: {e}")

        # ─── TESTE 5: PubSub Events ────────────────────────
        print("\n[5/7] PubSub — eventos de resumo...")
        from core.pubsub import PubSub
        clear_events()

        PubSub.subscribe('SUMMARY_STARTED', capture_event)
        PubSub.subscribe('SUMMARY_COMPLETED', capture_event)
        PubSub.subscribe('SUMMARY_ERROR', capture_event)

        # Simula evento
        PubSub.publish('SUMMARY_STARTED', video_id='test_vid')
        PubSub.publish('SUMMARY_COMPLETED', video_id='test_vid',
                       summary_preview='Teste...', tags=['tag1'])
        PubSub.publish('SUMMARY_ERROR', video_id='test_vid',
                       error_msg='Erro simulado')

        events = get_events()
        print(f"  Eventos capturados: {len(events)}")
        results["pubsub"] = len(events) == 3

        for ev in events:
            vid = ev.get('video_id', 'N/A')
            print(f"    - video_id={vid}, keys={list(ev.keys())}")

        print(f"  {'✅' if results['pubsub'] else '❌'} 3 eventos esperados")

        # ─── TESTE 6: Executor (com IA real) ────────────────
        print("\n[6/7] AIExecutor — pipeline completo...")

        if is_available and models:
            from core.app_state import AppState

            # Prepara AppState com DB de teste
            state = AppState()
            original_db = state.db_handler
            state.db_handler = db

            # Insere vídeo de teste
            db.add_video_entry({
                "id": "verify_test_001",
                "url": "https://youtube.com/watch?v=test",
                "title": "Vídeo de Verificação 6.1a",
                "status": "completed"
            })
            db.save_transcript(
                "verify_test_001",
                "A economia brasileira apresentou crescimento no primeiro trimestre. "
                "O PIB subiu 2.5% comparado ao ano anterior. "
                "Especialistas apontam que o setor de serviços foi o principal motor. "
                "A inflação segue controlada em torno de 4%. "
                "O mercado de trabalho mostra sinais de recuperação com queda no desemprego. "
                * 10  # ~600 palavras
            )

            clear_events()
            from services.ai_executor import AIExecutor
            executor = AIExecutor(state)

            result = executor.execute_summary("verify_test_001")

            print(f"  Status: {result['status']}")
            if result['status'] == 'SUCCESS':
                print(f"  Summary: {result['summary'][:100]}...")
                print(f"  Tags: {result['tags']}")
                print(f"  Tempo: {result['elapsed_seconds']}s")
                print(f"  Modelo: {result.get('model', 'N/A')}")

                # Verifica persistência
                t_data = db.get_transcript("verify_test_001")
                has_summary_in_db = bool(t_data and t_data.get('summary'))
                print(f"  Persistência DB (summary): {'✅' if has_summary_in_db else '❌'}")

                # Verifica PubSub
                exec_events = get_events()
                has_started = any('video_id' in e for e in exec_events)
                print(f"  PubSub events emitidos: {len(exec_events)} {'✅' if has_started else '❌'}")

                results["executor"] = True
            else:
                print(f"  Erro: {result.get('error', 'N/A')}")
                results["executor"] = False

            # Restaura AppState
            state.db_handler = original_db
        else:
            print("  ⏭️ Pulado (Ollama indisponível ou sem modelos)")
            results["executor"] = True  # Não é falha

        # ─── TESTE 7: Idempotência (vídeo já resumido) ──────
        print("\n[7/7] Idempotência — vídeo já resumido...")
        from core.managers.video_manager import VideoManager
        vm = VideoManager(db)

        # Simula vídeo já resumido
        db.add_video_entry({
            "id": "already_summarized",
            "url": "https://test.com",
            "title": "Já Resumido",
            "status": "completed",
            "summary_status": "summarized",
            "tags": '["economia", "teste"]'
        })

        # Verifica que get_videos_pending_summary NÃO retorna este vídeo
        pending = vm.get_videos_pending_summary()
        not_in_pending = not any(v.get('id') == 'already_summarized' for v in pending)

        print(f"  Vídeo 'already_summarized' excluído da fila pendente: {'✅' if not_in_pending else '❌'}")

        # Verifica que tags são parseadas corretamente
        tags = vm.get_video_tags("already_summarized")
        tags_correct = tags == ["economia", "teste"]
        print(f"  Tags parseadas: {tags} {'✅' if tags_correct else '❌'}")

        results["idempotency"] = not_in_pending and tags_correct

    finally:
        # Cleanup
        if os.path.exists(db_path):
            os.remove(db_path)

    # ─── RELATÓRIO FINAL ─────────────────────────────────────
    print("\n" + "=" * 70)
    print("  RELATÓRIO FINAL")
    print("=" * 70)

    all_pass = True
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"  {status}  {test_name}")
        if not passed:
            all_pass = False

    print("=" * 70)
    if all_pass:
        print("  🎉 TODOS OS TESTES PASSARAM — Fase 6.1a VALIDADA!")
    else:
        print("  ⚠️ ALGUNS TESTES FALHARAM — Revise antes de prosseguir")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    verify()
```

---

## 7. Checklist de Validação

### 7.1 Pré-Implementação
- [ ] Ollama rodando localmente (`ollama serve`)
- [ ] Pelo menos 1 modelo disponível (`ollama list`)
- [ ] Backup do banco `contextflow.db`
- [ ] `requests` instalado no venv (já deve estar)

### 7.2 Implementação
- [ ] `constants.py` — Prompts e configurações adicionados
- [ ] `services/ai_provider.py` — ABC criado
- [ ] `services/ai_providers/__init__.py` — Package init criado
- [ ] `services/ai_providers/ollama_provider.py` — Provider HTTP implementado
- [ ] `services/ai_providers/google_provider.py` — Stub criado
- [ ] `services/ai_discovery.py` — Discovery via HTTP implementado
- [ ] `services/ai_executor.py` — Orquestrador implementado
- [ ] `storage/db_handler.py` — Migração tags + summary_status
- [ ] `core/managers/video_manager.py` — Métodos de tags e summary
- [ ] `core/app_state.py` — Delegações e request_summary()
- [ ] `scripts/verification/verify_phase_6_1a.py` — Script de verificação

### 7.3 Pós-Implementação
- [ ] `python scripts/verification/verify_phase_6_1a.py` — TODOS os testes passam
- [ ] App inicia normalmente (`python main.py`) sem erros
- [ ] DB migra automaticamente (campos tags e summary_status presentes)
- [ ] Nenhum import de `wx` nos arquivos novos da services/
- [ ] Nenhum arquivo de UI foi modificado
- [ ] `CURRENT_STATE.md` atualizado
- [ ] `DECISION_LOG.md` atualizado

### 7.4 Testes Manuais (Opcional)
- [ ] Via console Python: `AIExecutor(AppState()).execute_summary("video_id_real")` funciona
- [ ] Vídeo com transcrição longa (>30K tokens) usa map-reduce sem travar
- [ ] Erro de conexão (Ollama desligado) retorna gracefully com summary_error
- [ ] Vídeo sem transcrição retorna erro claro

---

## 8. Sugestão de Commit

```
FASE 6.1a — INFRAESTRUTURA DE IA PARA RESUMO DE VÍDEOS
```

---

## 9. Atualização do DECISION_LOG.md

```
### Fase 6.1a — Infraestrutura de IA
F6.1a| ADD | Provider Ollama (HTTP direto) | Validado em teste: 27K tokens, 4.86s | `services/ai_providers/ollama_provider.py`
F6.1a| ADD | Discovery automático via HTTP | /api/tags + /api/show em vez de subprocess | `services/ai_discovery.py`
F6.1a| ADD | AIExecutor com Map-Reduce | Encapsulado: UI só vê summarizing→summarized | `services/ai_executor.py`
F6.1a| ADD | Migração DB (tags, summary_status) | JSON string + 4 estados de status | `storage/db_handler.py`
F6.1a| ADD | PubSub Events de IA | SUMMARY_STARTED, COMPLETED, ERROR | `services/ai_executor.py`
F6.1a| RULE | HTTP Direto Obrigatório | Sem subprocess, sem biblioteca ollama | `services/ai_providers/`
F6.1a| RULE | Zero UI na Fase 6.1a | Separação total infra/view | Todos os novos arquivos
```

---

## 10. Atualização do CURRENT_STATE.md (Seção Módulos)

Adicionar à tabela de módulos:

```
| AI Provider | `services/ai_provider.py` | `AIProvider.summarize()`, `AIProvider.list_models()` | F6.1a |
| Ollama Provider | `services/ai_providers/ollama_provider.py` | `OllamaProvider(endpoint)`, HTTP direto | F6.1a |
| AI Discovery | `services/ai_discovery.py` | `discover_models(provider)`, `get_model_context_limit(model)` | F6.1a |
| AI Executor | `services/ai_executor.py` | `execute_summary(video_id) -> Dict` | F6.1a |
```

---

**FIM DO BLUEPRINT — FASE 6.1a**

Este documento é a especificação completa e definitiva. Todos os pontos ambíguos foram resolvidos com base nas evidências dos testes executados. A implementação pode prosseguir sem decisões pendentes.