
import sys
import os
import logging

# Adiciona o diretório atual ao path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from core.token_engine import TokenEngine
from core.chunking_engine import TextChunker

logging.basicConfig(level=logging.INFO)

def test_token_engine():
    print("\n--- Testing TokenEngine ---")
    engine = TokenEngine()
    
    test_text = "ContextFlow is a high-density analytical workstation for YouTube videos."
    
    # Test OpenAI (tiktoken)
    tokens_oa = engine.count_tokens(test_text, provider="openai", model="gpt-4o-mini")
    print(f"OpenAI Tokens: {tokens_oa}")
    
    # Test Anthropic
    tokens_an = engine.count_tokens(test_text, provider="anthropic")
    print(f"Anthropic Tokens: {tokens_an}")
    
    # Test Gemini/Google
    tokens_go = engine.count_tokens(test_text, provider="google")
    print(f"Google/Gemini Tokens: {tokens_go}")
    
    # Verify fallback if dependencies fail
    tokens_fb = engine.count_tokens(test_text, provider="unknown")
    print(f"Fallback (1:4) Tokens: {tokens_fb}")

def test_text_chunker():
    print("\n--- Testing TextChunker ---")
    chunker = TextChunker(chunk_size=20, overlap_percent=0.1) # Small sizes for testing
    
    # Long-ish text
    long_text = " ".join(["word" + str(i) for i in range(100)])
    
    chunks = chunker.chunk_text(long_text)
    print(f"Number of chunks: {len(chunks)}")
    for i, chunk in enumerate(chunks[:3]):
        print(f"Chunk {i} (first 50 chars): {chunk[:50]}...")
    
    # Verify overlap
    if len(chunks) > 1:
        words0 = chunks[0].split()
        words1 = chunks[1].split()
        # Find intersection
        overlap = set(words0) & set(words1)
        print(f"Overlap detected: {len(overlap)} words")

if __name__ == "__main__":
    try:
        test_token_engine()
        test_text_chunker()
        print("\nVerification Script Completed Successfully.")
    except Exception as e:
        print(f"\nVerification Failed: {e}")
        import traceback
        traceback.print_exc()
