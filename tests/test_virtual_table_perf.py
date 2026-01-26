import time
import sys
import os
from unittest.mock import MagicMock

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Mock wx
mock_wx = MagicMock()
sys.modules['wx'] = mock_wx
sys.modules['wx.grid'] = MagicMock()

# Patch GridTableBase to be a normal class so we can inherit
class MockGridTableBase:
    def __init__(self): pass
    def GetAttr(self, row, col, kind): return MagicMock()

mock_wx.grid.GridTableBase = MockGridTableBase
mock_wx.grid.GridCellAttr = MagicMock

from ui.virtual_table import VirtualVideoTable

def run_perf_test():
    print("Preparing 5000 items...")
    data = []
    for i in range(5000):
        data.append({
            'id': f'vid_{i}',
            'title': f'Video Title {i} with some long text to simulate real data',
            'url': f'http://youtube.com/watch?v=vid_{i}',
            'duration': 125,
            'token_count': 1500,
            'status': 'completed',
            'upload_date': '20230101',
            'channel_name': 'Channel Name',
            'added_at': '2023-01-01 12:00:00',
            'playlist_title': 'Playlist X'
        })
    
    # 1. Test Copy Speed (Simulate AppState.get_all_videos safe copy)
    start = time.time()
    # "Safe copy" usually means list of dicts. 
    # Shallow copy of list is fast. Deep copy (dict(d)) is slower.
    # Let's test the stricter requirement: [dict(d) for d in data]
    snapshot = [dict(d) for d in data]
    elapsed_copy = (time.time() - start) * 1000
    print(f"Snapshot 5000 items: {elapsed_copy:.2f}ms")
    
    if elapsed_copy > 100: # Threshold is 100ms in doc (Critical) / 50ms (Goal)
        print("FAIL: Snapshot too slow > 100ms")
        sys.exit(1)

    # 2. Test VirtualTable Access
    table = VirtualVideoTable(snapshot)
    
    start = time.time()
    # Simulate a full refresh of visible area (e.g., 50 rows) + buffer = 100 rows
    # 11 columns
    for r in range(100):
        for c in range(11):
            _ = table.GetValue(r, c)
    elapsed_render = (time.time() - start) * 1000
    print(f"Render 100 rows (1100 cells): {elapsed_render:.2f}ms")
    
    if elapsed_render > 50:
        print("FAIL: Render too slow")
        sys.exit(1)
        
    print("SUCCESS: Performance within limits.")

if __name__ == '__main__':
    run_perf_test()
