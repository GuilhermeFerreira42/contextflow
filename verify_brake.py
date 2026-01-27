# verify_brake.py
import os
import sys
import time
import sqlite3

# Add project root to sys.path
sys.path.append(os.getcwd())

from core.cooldown_manager import CooldownManager
from storage.db_handler import DatabaseHandler
from core.app_state import AppState

def verify():
    print("--- Brake (Cooldown) Verification ---")
    db_path = "cooldown_test.db"
    if os.path.exists(db_path): os.remove(db_path)
    
    # 1. Initialize
    db = DatabaseHandler(db_path)
    state = AppState()
    state.db_handler = db
    
    mgr = CooldownManager(state)
    
    # 2. Trigger Cooldown
    print("Step 1: Triggering 5-minute cooldown...")
    mgr.trigger_cooldown(300)
    
    # 3. Check Immediately
    is_cooling = mgr.is_cooling_down()
    remaining = mgr.get_remaining_cooldown()
    print(f"Is cooling: {is_cooling}, Remaining: {remaining}s")
    
    if not is_cooling:
        print("FAILURE: Cooldown not active after trigger.")
        return

    # 4. Simulate Restart (Persistence Check)
    print("\nStep 2: Simulating app restart...")
    # Re-instantiate everything pointing to the same DB
    db2 = DatabaseHandler(db_path)
    state2 = AppState()
    state2.db_handler = db2
    mgr2 = CooldownManager(state2)
    
    is_cooling_persisted = mgr2.is_cooling_down()
    remaining_persisted = mgr2.get_remaining_cooldown()
    print(f"Persisted - Is cooling: {is_cooling_persisted}, Remaining: {remaining_persisted}s")
    
    if is_cooling_persisted and remaining_persisted > 0:
        print("SUCCESS: Cooldown persisted in SQLite.")
    else:
        print("FAILURE: Cooldown lost after restart.")
        return

    # 5. Clear Cooldown
    print("\nStep 3: Clearing cooldown manually...")
    mgr2.clear_cooldown()
    if not mgr2.is_cooling_down():
        print("SUCCESS: Cooldown cleared.")
    else:
        print("FAILURE: Cooldown still active after clear.")

    # Cleanup
    if os.path.exists(db_path): os.remove(db_path)

if __name__ == '__main__':
    verify()
