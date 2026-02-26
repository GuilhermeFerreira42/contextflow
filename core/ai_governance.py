# contextflow/core/ai_governance.py
import json
import hashlib
import os
import logging
import datetime
from typing import Dict, Any, Optional, Tuple
import tiktoken

from constants import AI_PRICES_PATH, MODEL_NAME
from core.app_state import AppState

logger = logging.getLogger("contextflow.governance")

class TokenCounter:
    @staticmethod
    def count_tokens(text: str, model: str = MODEL_NAME, provider: str = "openai") -> int:
        """
        Conta tokens de forma agnóstica. 
        [Fase 6] Se tiktoken falhar ou o provedor for local/gemini, utiliza heurística de fallback.
        """
        if provider == "openai":
            try:
                encoding = tiktoken.encoding_for_model(model)
                return len(encoding.encode(text))
            except Exception:
                pass
        
        # Heurística Universal (Fallback): 1 token ~ 4 caracteres
        # Proporciona uma estimativa de custo conservadora e segura para o dashboard.
        return len(text) // 4

class AICostCalculator:
    def __init__(self, prices_path: str = AI_PRICES_PATH):
        self.prices_path = prices_path
        self.prices = self._load_prices()

    def _load_prices(self) -> Dict[str, Any]:
        if not os.path.exists(self.prices_path):
            logger.warning(f"Price config not found at {self.prices_path}. Using zero rates.")
            return {}
        try:
            with open(self.prices_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load AI prices: {e}")
            return {}

    def estimate_cost(self, prompt_tokens: int, completion_tokens: int, model: str = MODEL_NAME, provider: str = "openai") -> float:
        provider_data = self.prices.get(provider, {})
        model_data = provider_data.get(model, {})
        
        input_1k = model_data.get("input_1k", 0.0)
        output_1k = model_data.get("output_1k", 0.0)
        
        cost = (prompt_tokens / 1000.0 * input_1k) + (completion_tokens / 1000.0 * output_1k)
        return round(cost, 6)

class AICacheManager:
    def __init__(self, db_handler):
        self.db = db_handler

    def generate_hash(self, video_id: str, text: str, prompt_checksum: str) -> str:
        """Gera hash determinístico SHA256."""
        # [GOVERNANCE] Normalização de espaços (trim/split) é MANDATÓRIA.
        # Diferenças de formatação (ex: \n vs espaço) não devem gerar Cache Miss.
        norm_text = " ".join(text.split())
        payload = f"{video_id}|{norm_text}|{prompt_checksum}"
        return hashlib.sha256(payload.encode('utf-8')).hexdigest()


    def get_cached_response(self, hash_key: str, current_prompt_checksum: str) -> Optional[Dict[str, Any]]:
        cached = self.db.get_ai_cache(hash_key)
        if cached:
            # [GOVERNANCE] Invariante 2.2: Validação Cruzada de Checksum.
            # Se o Prompt do Sistema mudar, o cache antigo torna-se inválido para garantir
            # consistência com as novas regras de negócio da IA.
            if cached.get('prompt_checksum') == current_prompt_checksum:
                return json.loads(cached['response_json'])
            else:
                logger.info("Cache hit, but prompt checksum mismatch. Ignoring cache.")
        return None


    def save_to_cache(self, hash_key: str, response: Dict[str, Any], prompt_checksum: str, model: str):
        self.db.save_ai_cache(hash_key, json.dumps(response), prompt_checksum, model)

class AIGovernance:
    def __init__(self, app_state: Optional[AppState] = None):
        self.app_state = app_state or AppState()
        self.db = self.app_state.db_handler
        self.cost_calculator = AICostCalculator()
        self.cache_manager = AICacheManager(self.db)
        
    def get_prompt_checksum(self, prompt_text: str) -> str:
        return hashlib.md5(prompt_text.encode('utf-8')).hexdigest()

    def pre_api_call(self, video_id: str, text: str, prompt: str, model: str, provider: str) -> Tuple[str, str, Optional[Dict[str, Any]]]:
        """
        Calcula hash e verifica cache antes de chamar a API.
        Retorna (hash_key, prompt_checksum, cached_response).
        """
        checksum = self.get_prompt_checksum(prompt)
        h_key = self.cache_manager.generate_hash(video_id, text, checksum)
        cached = self.cache_manager.get_cached_response(h_key, checksum)
        return h_key, checksum, cached

    def log_and_bill(self, video_id: str, data: Dict[str, Any]):
        """
        Registra o uso no log de auditoria.
        Data deve conter: model_name, provider, input_hash, prompt_checksum, 
        input_tokens, output_tokens, status, etc.
        """
        model = data.get('model_name', MODEL_NAME)
        provider = data.get('provider', 'openai')
        
        # Calcular custo se não fornecido
        if 'estimated_cost' not in data:
            data['estimated_cost'] = self.cost_calculator.estimate_cost(
                data.get('input_tokens', 0),
                data.get('output_tokens', 0),
                model,
                provider
            )
            
        # Período de faturamento
        data['billing_period'] = datetime.datetime.now().strftime("%Y-%m")
        
        self.db.log_ai_usage(data)
        logger.info(f"AI Usage logged for video {video_id} ({provider}/{model}). Est. Cost: ${data['estimated_cost']}")
        
        # Atualiza saldo da sessão no AppState
        cost = data['estimated_cost']
        self.app_state.decrement_session_budget(cost)

    def check_session_budget(self, estimated_cost: float) -> bool:
        """
        [FASE 6] Bloqueio Financeiro Preventivo.
        Verifica se o custo estimado cabe no saldo atual da sessão.
        """
        current_budget = self.app_state.get_session_budget()
        if estimated_cost > current_budget:
            logger.warning(f"Pre-flight check failed: Estimated {estimated_cost} > Budget {current_budget}")
            return False
        return True
