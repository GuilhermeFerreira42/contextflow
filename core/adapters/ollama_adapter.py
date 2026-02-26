# contextflow/core/adapters/ollama_adapter.py
import requests
import json
import logging
from typing import Generator, Dict, Any
from core.adapters.base_adapter import BaseAIAdapter

logger = logging.getLogger("contextflow.ollama")

class OllamaAdapter(BaseAIAdapter):
    """
    Adaptador para Ollama (IA Local).
    [ESTABILIDADE] Implementa a lógica de streaming via API REST local.
    """

    def generate_summary_stream(self, transcript: str, prompt_template: str, config: Dict[str, Any]) -> Generator[str, None, Dict[str, Any]]:
        base_url = config.get("base_url", "http://localhost:11434")
        model = config.get("model", "llama3")
        
        url = f"{base_url}/api/chat"
        prompt = prompt_template.format(transcript=transcript)
        
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "stream": True
        }
        
        try:
            # Timeout longo para IA local que pode demorar a começar o "think"
            response = requests.post(url, json=payload, stream=True, timeout=120)
            response.raise_for_status()
            
            full_response = ""
            for line in response.iter_lines():
                if line:
                    chunk = json.loads(line)
                    if "message" in chunk and "content" in chunk["message"]:
                        content = chunk["message"]["content"]
                        full_response += content
                        yield content
                    
                    if chunk.get("done"):
                        # Ollama envia métricas de tokens no final da stream
                        return {
                            "input_tokens": chunk.get("prompt_eval_count", 0),
                            "output_tokens": chunk.get("eval_count", 0),
                            "status": "SUCCESS"
                        }
            
            return {
                "input_tokens": self.count_tokens(prompt),
                "output_tokens": self.count_tokens(full_response),
                "status": "SUCCESS"
            }
            
        except Exception as e:
            logger.error(f"Ollama error: {e}")
            return {"status": "FAILED", "error": str(e)}

    def count_tokens(self, text: str) -> int:
        # Aproximação conservadora para modelos locais
        return len(text) // 4

    def validate_config(self, config: Dict[str, Any]) -> bool:
        # Verifica se o Ollama está "vivo"
        base_url = config.get("base_url", "http://localhost:11434")
        try:
            resp = requests.get(f"{base_url}/api/tags", timeout=2)
            return resp.status_code == 200
        except:
            return False

    def get_available_models(self, config: Dict[str, Any]) -> list:
        """Busca modelos instalados no Ollama local."""
        base_url = config.get("base_url", "http://localhost:11434")
        try:
            resp = requests.get(f"{base_url}/api/tags", timeout=3)
            if resp.status_code == 200:
                data = resp.json()
                return [m['name'] for m in data.get('models', [])]
        except:
            pass
        return ["llama3", "phi3"] # Fallback
