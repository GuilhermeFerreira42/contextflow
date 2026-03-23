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
