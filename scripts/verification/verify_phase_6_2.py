import os
import sys
import wx

# Adiciona o diretório raiz ao path para importações
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from core.config_manager import ConfigManager
from core.managers.theme_manager import ThemeManager

def verify_block_a():
    print("--- Verificando Bloco A: Organização ---")
    
    # 1. ConfigManager
    config = ConfigManager()
    active_provider = config.get("orchestration", "active_provider")
    print(f"Provedor Ativo: {active_provider} (Esperado: ollama)")
    assert active_provider == "ollama"
    
    ui_config = config.get("ui")
    print(f"Config UI: {ui_config}")
    assert "theme" in ui_config
    assert "column_widths" in ui_config
    
    # 2. Scripts debug removidos
    debug_dir = os.path.join("scripts", "debug")
    if os.path.exists(debug_dir):
        print(f"AVISO: {debug_dir} ainda existe.")
    else:
        print("OK: scripts/debug removido.")
        
    print("Bloco A: OK\n")

def verify_block_b():
    print("--- Verificando Bloco B: UX ---")
    
    # 1. TagWrapPanel
    twp_path = os.path.join("ui", "components", "tag_wrap_panel.py")
    assert os.path.exists(twp_path), "TagWrapPanel não encontrado"
    print("OK: TagWrapPanel.py existe.")
    
    # 2. Sidebar context menu (Check via grep ou import se possível)
    from ui.sidebar import Sidebar
    # Verificação básica de métodos novos (se houver) ou apenas presença do arquivo
    print("OK: Sidebar importado com sucesso.")

    # 3. VirtualTable Renderer
    from ui.virtual_table import SummaryStatusRenderer
    print("OK: SummaryStatusRenderer disponível.")
    
    print("Bloco B: OK\n")

def verify_block_c():
    print("--- Verificando Bloco C: Temas ---")
    
    app = wx.App()
    theme = ThemeManager()
    
    current = theme.get_theme_name()
    print(f"Tema Atual: {current}")
    assert current in ["light", "dark"]
    
    # Testa troca de tema
    theme.set_theme("dark")
    assert theme.get_theme_name() == "dark"
    print("OK: Troca de tema funcional (Dark).")
    
    theme.set_theme("light")
    assert theme.get_theme_name() == "light"
    print("OK: Troca de tema funcional (Light).")
    
    app.Destroy()
    print("Bloco C: OK\n")

if __name__ == "__main__":
    try:
        verify_block_a()
        verify_block_b()
        verify_block_c()
        print("VERIFICAÇÃO COMPLETA: FASE 6.2 BEM-SUCEDIDA.")
    except Exception as e:
        print(f"FALHA NA VERIFICAÇÃO: {e}")
        sys.exit(1)
