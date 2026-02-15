# test_config.py
import sys
import os
# Adiciona o diretório atual ao path para importar core
sys.path.append(os.path.abspath("."))

from core.config_manager import ConfigManager

def test_config():
    print("Iniciando teste de ConfigManager...")
    mgr = ConfigManager()
    
    # Teste de Valor Default
    openai_key = mgr.get("api_keys", "openai")
    print(f"OpenAI Key Default: '{openai_key}'")
    
    # Teste de Set e Save
    print("Alterando OpenAI Key...")
    mgr.set("api_keys", "openai", "sk-TEST-12345")
    
    # Verifica recarregamento
    mgr2 = ConfigManager() # Singleton
    val = mgr2.get("api_keys", "openai")
    print(f"OpenAI Key após set: '{val}'")
    
    if val == "sk-TEST-12345":
        print("✅ Teste de Set/Get: SUCESSO")
    else:
        print("❌ Teste de Set/Get: FALHA")

    # Verifica se o arquivo existe
    if os.path.exists(mgr.config_path):
        print(f"✅ Arquivo criado em: {mgr.config_path}")
    else:
        print("❌ Arquivo NÃO criado")

if __name__ == "__main__":
    test_config()
