import os
import sys
import wx

# Define path to include project root
sys.path.append(os.path.abspath('.'))

try:
    # Need a dummy app for wx colors to work
    app = wx.App()
    from core.app_state import AppState
    from core.managers.theme_manager import ThemeManager
    from core.managers.finance_manager import FinanceManager
    from core.managers.video_manager import VideoManager
    from core.managers.task_manager import TaskManager

    print("--- Verificação de Estrutura: Fase 6.0 ---")
    
    # 1. Test Singleton AppState & Managers
    state = AppState()
    print(f"AppState initialized: {state is not None}")
    print(f"VideoManager: {state.video_manager is not None}")
    print(f"FinanceManager: {state.finance_manager is not None}")
    print(f"TaskManager: {state.task_manager is not None}")
    print(f"ThemeManager: {state.theme_manager is not None}")

    # 2. Test ThemeManager Colors
    theme = ThemeManager()
    print(f"Theme Background: {theme.get_bg_color().GetAsString(wx.C2S_HTML_SYNTAX)}")
    
    # 3. Test FinanceManager DB creation
    # FinanceManager will create data/billing.db on init
    db_path = os.path.join('data', 'billing.db')
    print(f"billing.db exists: {os.path.exists(db_path)}")

    # 4. Test TaskManager Semaphore
    tm = TaskManager()
    print(f"TM generic workers: {tm._generic_executor._max_workers}")
    print(f"TM AI workers (Semaphore): {tm._ai_executor._max_workers}")

    print("\n--- SUCESSO: Estrutura Blindada ---")
    
except Exception as e:
    print(f"--- FALHA NA VERIFICAÇÃO: {e}")
    sys.exit(1)
