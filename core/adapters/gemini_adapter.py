# contextflow/core/adapters/gemini_adapter.py
from typing import Generator, Dict, Any
from core.adapters.base_adapter import BaseAIAdapter
import logging

logger = logging.getLogger("contextflow.gemini")

class GeminiAdapter(BaseAIAdapter):
    """
    Adaptador para Google Gemini.
    [RNF] Focado em latência reduzida e alta janela de contexto.
    """
    
    def generate_summary_stream(self, transcript: str, prompt_template: str, config: Dict[str, Any]) -> Generator[str, None, Dict[str, Any]]:
        api_key = config.get("api_key")
        model_name = config.get("model", "gemini-1.5-flash")
        
        try:
            import google.generativeai as genai
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel(model_name)
            
            prompt = prompt_template.format(transcript=transcript)
            
            response = model.generate_content(prompt, stream=True)
            
            full_response = ""
            for chunk in response:
                if chunk.text:
                    full_response += chunk.text
                    yield chunk.text
            
            # Gemini tem API de contagem de tokens real, mas para simplificar o MVP 
            # e manter a agnostia, usamos aproximação se a lib não suportar fácil
            input_tokens = self.count_tokens(prompt)
            output_tokens = self.count_tokens(full_response)
            
            return {
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "status": "SUCCESS"
            }
        except Exception as e:
            logger.error(f"Gemini error: {e}")
            return {"status": "FAILED", "error": str(e)}

    def count_tokens(self, text: str) -> int:
        # Aproximação: 1 token ~ 4 caracteres para texto em português/inglês
        # Melhor que nada para o dashboard de governança
        return len(text) // 4

    def validate_config(self, config: Dict[str, Any]) -> bool:
        return bool(config.get("api_key"))
