# verify_telemetry.py
import os
import sys
import sqlite3
import time
import threading
from queue import Queue

# Add project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from core.processor import Processor, ProcessingTask
from core.app_state import AppState

def verify():
    db_path = "telemetry_test.db"
    if os.path.exists(db_path): os.remove(db_path)
    
    # Initialize state with test DB
    from storage.db_handler import DatabaseHandler
    db_handler = DatabaseHandler(db_path)
    state = AppState()
    state.db_handler = db_handler # Mock/Override for test
    
    # We need to ensure contextflow/config/ai_prices.json exists for the test
    # but we already have it in the real config. Since we are in the root, it should find it.
    
    proc = Processor(state)
    proc.active = True
    
    # Simulate a task
    url = "https://www.youtube.com/watch?v=jNQXAC9IVRw" # Standard test vid
    task = ProcessingTask(url)
    
    print(f"Step 1: Processing task {task.uuid}...")
    # Directly call _process_task to avoid needing a full worker loop for simple verification
    proc._process_task(task)
    
    print("Step 2: Checking DB for logged metrics...")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM ai_usage_log")
    log = c.fetchone()
    
    if log:
        print("\n--- Metrics Log Found ---")
        print(f"Video ID: {log['video_id']}")
        print(f"Status: {log['status']}")
        print(f"Queue Wait: {log['queue_wait_ms']}ms")
        print(f"Fetch Time: {log['fetch_ms']}ms")
        print(f"LLM Time: {log['llm_processing_ms']}ms")
        print(f"Total TTI: {log['total_tti_ms']}ms")
        print(f"Overhead: {log['ui_render_ms']}ms")
        
        if log['fetch_ms'] > 0 and log['llm_processing_ms'] > 0:
            print("\nSUCCESS: Granular metrics captured successfully.")
        else:
            print("\nFAILURE: Some metrics are zero.")
    else:
        print("\nFAILURE: No audit log found in DB.")
    
    conn.close()
    if os.path.exists(db_path): os.remove(db_path)

if __name__ == '__main__':
    verify()
