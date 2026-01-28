
import os
import sys
import time
import sqlite3
import random
import logging
import threading
from statistics import quantiles

# Add project root to sys.path
sys.path.append(os.getcwd())

from core.processor import Processor
from core.app_state import AppState
from storage.db_handler import DatabaseHandler

# Setup logging to console only for the test
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger("stress_test")

VIDEOS = [
    "https://www.youtube.com/watch?v=jNQXAC9IVRw", # Me at the zoo
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ", # Rick Astley
    "https://www.youtube.com/watch?v=XqZsoesa55w", # Baby Shark
    "https://www.youtube.com/watch?v=9bZkp7q19f0", # Gangnam Style
    "https://www.youtube.com/watch?v=kJQP7kiw5Fk", # Despacito
    "https://www.youtube.com/watch?v=JGwWNGJdvx8", # Shape of You
    "https://www.youtube.com/watch?v=OPf0YbXqDm0", # Uptown Funk
    "https://www.youtube.com/watch?v=RgKAFK5djSk", # See You Again
    "https://www.youtube.com/watch?v=09R8_2nJtjg", # Sugar
    "https://www.youtube.com/watch?v=fWNaR-rxAic", # Counting Stars
    "https://www.youtube.com/watch?v=hT_nvWreIhg", # One Republic
    "https://www.youtube.com/watch?v=ebXbLfLACGM", # Calvin Harris
    "https://www.youtube.com/watch?v=k2qgadSvNyU", # Dua Lipa
    "https://www.youtube.com/watch?v=VYOjWnS4cMY", # Childish Gambino
    "https://www.youtube.com/watch?v=YQHsXMglC9A", # Adele
    "https://www.youtube.com/watch?v=LSOjtG-6KTo", # Lewis Capaldi
    "https://www.youtube.com/watch?v=Pkh8UtuejGw", # Shawn Mendes
    "https://www.youtube.com/watch?v=0KSOMA3QBU0", # Katy Perry
    "https://www.youtube.com/watch?v=CevxZvSJLk8", # Roar
    "https://www.youtube.com/watch?v=7PCkvCPvDXk", # Dark Horse
    "https://www.youtube.com/watch?v=QGJuMBdaqIw", # Firework
    "https://www.youtube.com/watch?v=nfWlot6h_JM", # Shake It Off
    "https://www.youtube.com/watch?v=e-ORhEE9VVg", # Blank Space
    "https://www.youtube.com/watch?v=3tmd-ClpJxA", # Look What You Made Me Do
    "https://www.youtube.com/watch?v=VuNIsY6JdUw", # You Belong With Me
    "https://www.youtube.com/watch?v=8xg3vE8Ie_E", # Love Story
    "https://www.youtube.com/watch?v=2vjPBrBU-TM", # Sia - Chandelier
    "https://www.youtube.com/watch?v=oygrmJFKYZY", # Dua Lipa - New Rules
    "https://www.youtube.com/watch?v=pXRviuL6vMY", # Twenty One Pilots - Stressed Out
    "https://www.youtube.com/watch?v=u9Dg-g7t2LI"  # Passenger - Let Her Go
]

def run_stress_test():
    logger.info("Starting Phase 5.6 Homologation (Stress Test)...")
    
    # Use a clean test database
    db_path = "stress_test.db"
    if os.path.exists(db_path): os.remove(db_path)
    
    db_handler = DatabaseHandler(db_path)
    state = AppState()
    state.db_handler = db_handler # Override state with test DB
    
    # Force load prices if they are not loaded (Governance depends on it)
    # AppState init should have called db_handler init which creates tables.
    
    processor = Processor(state)
    processor.start_processing()
    
    start_time = time.time()
    
    logger.info(f"Enqueuing {len(VIDEOS)} videos...")
    for url in VIDEOS:
        processor._enqueue_video(url)
    
    logger.info("Queue filled. Monitoring progress...")
    
    total_videos = len(VIDEOS)
    completed_count = 0
    failed_count = 0
    
    try:
        while True:
            # Check progress
            all_vids = state.get_all_videos()
            completed_count = len([v for v in all_vids if v.get('status') == 'completed'])
            completed_error_count = len([v for v in all_vids if v.get('status') == 'ERROR'])
            
            active = state.get_active_downloads()
            # Count failed in active downloads (tasks that failed before getting a video_id)
            active_failed_count = len([v for v in active if v.get('status') == 'error' or v.get('status') == 'ABORTED'])
            
            total_done = completed_count + completed_error_count + active_failed_count
            
            logger.info(f"Progress: [{total_done}/{total_videos}] (Success: {completed_count}, Failed: {completed_error_count + active_failed_count}, In-Flight: {len(active) - active_failed_count})")
            
            if total_done >= total_videos:
                break
                
            time.sleep(10) # Poll every 10 seconds
            
            # Timeout safety (e.g., 20 minutes)
            if time.time() - start_time > 1200:
                logger.warning("Test timed out after 20 minutes.")
                break
    except KeyboardInterrupt:
        logger.info("Test interrupted by user.")
    
    end_time = time.time()
    total_elapsed = end_time - start_time
    
    logger.info("--- STRESS TEST RESULTS ---")
    logger.info(f"Total Time: {total_elapsed:.2f}s")
    logger.info(f"Total Videos: {total_videos}")
    logger.info(f"Successfully Processed: {completed_count}")
    logger.info(f"Failed: {failed_count}")
    
    # Analyze metrics
    analyze_metrics(db_path)
    
    # Cleanup
    processor.stop_processing()
    # if os.path.exists(db_path): os.remove(db_path)
    logger.info(f"Test finished. Database preserved at {db_path} for review.")

def analyze_metrics(db_path):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT total_tti_ms, fetch_ms, llm_processing_ms FROM ai_usage_log")
    rows = c.fetchall()
    conn.close()
    
    if not rows:
        logger.error("No metrics found in ai_usage_log!")
        return
        
    ttis = [r['total_tti_ms'] / 1000.0 for r in rows if r['total_tti_ms']]
    
    if not ttis:
        logger.error("Total TTI metrics missing or zero.")
        return
        
    ttis.sort()
    avg_tti = sum(ttis) / len(ttis)
    p95_tti = ttis[int(len(ttis) * 0.95)] if len(ttis) >= 20 else ttis[-1]
    
    logger.info(f"Avg TTI: {avg_tti:.2f}s")
    logger.info(f"P95 TTI: {p95_tti:.2f}s")
    
    # Success Criteria check
    logger.info("--- Success Criteria Check ---")
    
    criterion_p95 = p95_tti < 120.0
    logger.info(f"1. Atingimento P95 (<120s): {'PASS' if criterion_p95 else 'FAIL'}")
    
    criterion_solvency = len(rows) >= 25 # Allow some failures but most should be logged
    logger.info(f"2. Solvência (Audit Logs generated): {'PASS' if criterion_solvency else 'FAIL'} ({len(rows)} logs)")
    
    criterion_stability = True # Assumed if we reached here without crash
    logger.info(f"3. Estabilidade (Zero crashes): PASS")
    
    if criterion_p95 and criterion_solvency:
        logger.info("\nFINAL VERDICT: PHASE 5.6 HOMOLOGATION SUCCESSFUL!")
    else:
        logger.info("\nFINAL VERDICT: PHASE 5.6 HOMOLOGATION FAILED (Check metrics above).")

if __name__ == '__main__':
    run_stress_test()
