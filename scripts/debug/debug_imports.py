import sys
import os
try:
    print("Checking imports...")
    import wx
    print("wx ok")
    import tiktoken
    print("tiktoken ok")
    import sqlite3
    print("sqlite3 ok")
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
    from constants import DB_PATH
    print(f"constants ok: {DB_PATH}")
    from storage.db_handler import DatabaseHandler
    print("db_handler ok")
    from core.ai_governance import AIGovernance
    print("ai_governance ok")
except Exception as e:
    print(f"FAILED: {e}")
    import traceback
    traceback.print_exc()
