# verify_integrity.py
import os
import sys
import sqlite3

# Add project root to sys.path
sys.path.append(os.getcwd())

from storage.db_handler import DatabaseHandler

def verify():
    db_path = "integrity_test.db"
    if os.path.exists(db_path): os.remove(db_path)
    
    db = DatabaseHandler(db_path)
    
    video_id = "test_vid_123"
    video_data = {
        'id': video_id,
        'url': 'https://youtube.com/watch?v=123',
        'title': 'Test Video'
    }
    
    print("Step 1: Adding video...")
    db.add_video_entry(video_data)
    
    print("Step 2: Logging AI usage...")
    usage = {
        'video_id': video_id,
        'model_name': 'gpt-4o',
        'provider': 'openai',
        'input_hash': 'h1',
        'prompt_checksum': 'p1',
        'input_tokens': 100,
        'output_tokens': 50,
        'estimated_cost': 0.002,
        'billing_period': '2026-01',
        'status': 'SUCCESS'
    }
    db.log_ai_usage(usage)
    
    # Verify both exist
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute("SELECT count(*) FROM videos")
    print(f"Videos count: {c.fetchone()[0]}")
    c.execute("SELECT count(*) FROM ai_usage_log")
    print(f"AI Logs count: {c.fetchone()[0]}")
    
    print("Step 3: Deleting video...")
    db.delete_video(video_id)
    
    c.execute("SELECT count(*) FROM videos")
    v_count = c.fetchone()[0]
    print(f"Videos count after delete: {v_count}")
    
    c.execute("SELECT count(*) FROM ai_usage_log")
    l_count = c.fetchone()[0]
    print(f"AI Logs count after delete: {l_count}")
    
    if v_count == 0 and l_count == 1:
        print("\nSUCCESS: Financial integrity maintained. AI Log survived video deletion.")
    else:
        print("\nFAILURE: Integrity check failed.")
    
    conn.close()
    if os.path.exists(db_path): os.remove(db_path)

if __name__ == '__main__':
    verify()
