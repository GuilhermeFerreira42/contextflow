# contextflow/core/chunking_engine.py
import logging
from typing import List
from core.token_engine import TokenEngine

logger = logging.getLogger("contextflow.chunking")

class TextChunker:
    """
    Alocador de Segmentação para Phase 7.
    Divide transcrições em blocos baseados em tokens com sobreposição (overlap).
    """
    def __init__(self, chunk_size: int = 1000, overlap_percent: float = 0.1):
        self.chunk_size = chunk_size
        self.overlap_size = int(chunk_size * overlap_percent)
        self.token_engine = TokenEngine()

    def chunk_text(self, text: str, provider: str = "openai", model: str = "gpt-4o-mini") -> List[str]:
        """
        Divide o texto em pedaços (chunks) respeitando o limite de tokens.
        Nota: Esta implementação inicial usa uma aproximação baseada em palavras 
        para performance, validando o tamanho final via TokenEngine.
        """
        if not text: return []
        
        words = text.split()
        chunks = []
        current_chunk_words = []
        
        # Heurística: cada palavra tem ~1.3 tokens em média
        words_per_chunk = int(self.chunk_size / 1.3)
        overlap_words = int(self.overlap_size / 1.3)
        
        for i in range(0, len(words), words_per_chunk - overlap_words):
            chunk_content = " ".join(words[i : i + words_per_chunk])
            if chunk_content:
                chunks.append(chunk_content)
                
            if i + words_per_chunk >= len(words):
                break
                
        logger.info(f"Text split into {len(chunks)} chunks (Target: {self.chunk_size} tokens)")
        return chunks
