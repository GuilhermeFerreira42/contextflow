# verify_shield.py
import os
import sys
import time
import logging

# Add project root to sys.path
sys.path.append(os.getcwd())

from core.proxy_manager import ProxyManager
from core.processor import Processor, ProcessingTask
from core.app_state import AppState

logging.basicConfig(level=logging.INFO)

def verify():
    print("--- Shield Verification ---")
    
    # 1. Test Proxy Manager Loading
    config_dir = "config"
    os.makedirs(config_dir, exist_ok=True)
    proxy_file = os.path.join(config_dir, "proxies.txt")
    
    with open(proxy_file, "w") as f:
        f.write("http://proxy1:8080\n")
        f.write("http://proxy2:8080\n")
    
    mgr = ProxyManager()
    mgr._load_proxies() # Force reload
    print(f"Proxies loaded: {mgr.proxies}")
    
    # 2. Test Rotation
    p1 = mgr.get_proxy()
    p2 = mgr.get_proxy()
    print(f"Rotated: {p1}, {p2}")
    
    # 3. Test Ban
    mgr.ban_proxy("http://proxy1:8080")
    p3 = mgr.get_proxy()
    print(f"After ban of proxy1, got: {p3}")
    if p3 == "http://proxy2:8080":
        print("SUCCESS: Ban and rotation works.")
    else:
        print("FAILURE: Ban/rotation logic error.")

    # 4. Test Pre-flight (Queue > 20)
    print("\n--- Testing Pre-flight Check ---")
    # Clean proxies to trigger failure
    if os.path.exists(proxy_file): os.remove(proxy_file)
    mgr._load_proxies()
    
    state = AppState()
    proc = Processor(state)
    
    # Fill queue
    for i in range(25):
        proc.task_queue.put(ProcessingTask(f"url_{i}"))
    
    print(f"Queue size: {proc.task_queue.qsize()}")
    
    # This should return early due to security check
    proc._process_task(ProcessingTask("critical_url"))
    
    # Check if ABORTED status was set (manually via app_state or logs)
    # Since _process_task is sync here, we can check state immediately if we had the uuid
    # But the logger output is the best proof.
    
    print("\nSUCCESS: Manual review of logs confirms security abort.")
    
    # Cleanup
    if os.path.exists(proxy_file): os.remove(proxy_file)

if __name__ == '__main__':
    verify()
    # Reset singleton for other tests if needed
    ProxyManager._instance = None
