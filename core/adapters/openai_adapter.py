# contextflow/core/adapters/openai_adapter.py
import tiktoken
from typing import Generator, Dict, Any
from core.adapters.base_adapter import BaseAIAdapter
import openai
import logging

logger = logging.getLogger("contextflow.openai")

class OpenAIAdapter(BaseAIAdapter):
    def __init__(self):
        self._tokenizer = None

    def _get_tokenizer(self, model_name: str):
        if not self._tokenizer:
            try:
                self._tokenizer = tiktoken.encoding_for_model(model_name)
            except:
                self._tokenizer = tiktoken.get_encoding("cl100k_base")
        return self._tokenizer

    def generate_summary_stream(self, transcript: str, prompt_template: str, config: Dict[str, Any]) -> Generator[str, None, Dict[str, Any]]:
        api_key = config.get("api_key")
        model = config.get("model", "gpt-4o-mini")
        
        client = openai.OpenAI(api_key=api_key)
        
        prompt = prompt_template.format(transcript=transcript)
        
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                stream=True
            )
            
            full_response = ""
            for chunk in response:
                if chunk.choices[0].delta.content:
                    content = chunk.choices[0].delta.content
                    full_response += content
                    yield content
            
            # Cálculo aproximado de tokens (OpenAI não envia no stream sem flags extras)
            input_tokens = self.count_tokens(prompt)
            output_tokens = self.count_tokens(full_response)
            
            return {
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "status": "SUCCESS"
            }
        except Exception as e:
            logger.error(f"OpenAI error: {e}")
            return {"status": "FAILED", "error": str(e)}

    def count_tokens(self, text: str) -> int:
        # Fallback para gpt-4o-mini encoding
        enc = self._get_tokenizer("gpt-4o-mini")
        return len(enc.encode(text))

    def validate_config(self, config: Dict[str, Any]) -> bool:
        return bool(config.get("api_key"))
