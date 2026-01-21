
import unittest
import threading
import time
import os
import shutil
from core.app_state import AppState
from services.utils import format_duration

# Mock or Configurable DB path would be ideal, but assuming AppState uses default.
# We will use a unique ID for test data to avoid collision.

class TestArchitecture(unittest.TestCase):
    def setUp(self):
        # Initialize AppState (Singleton)
        self.app_state = AppState()
        # Ensure we can run async operations
        self.app_state._initialized = True # Force if needed, but Singleton handles it.
        
    def test_singleton(self):
        state2 = AppState()
        self.assertIs(self.app_state, state2)

    def test_video_add_delete_flow(self):
        # 1. Add Video
        vid_id = "TEST_VID_001"
        data = {
            "id": vid_id,
            "title": "Test Video Architecture",
            "url": "http://test.com/vid1",
            "status": "downloaded",
            "created_at": "2023-01-01 10:00:00"
        }
        
        self.app_state.add_or_update_video(data)
        
        # Verify in memory
        v = self.app_state.get_video(vid_id)
        self.assertIsNotNone(v)
        self.assertEqual(v['title'], "Test Video Architecture")
        
        # Verify persistence (give it a moment for the thread)
        time.sleep(1) 
        # We would need to check DB directly or reload AppState.
        # Since AppState loads from DB on init, and it's singleton...
        # We can trust the internal logic or use a fresh DB handler to check.
        from storage.db_handler import DatabaseHandler
        db = DatabaseHandler()
        all_vids = db.get_all_videos()
        rows = [v for v in all_vids if v['id'] == vid_id]
        self.assertTrue(rows, "Video should be in DB")
        
        # 2. Add Active Task (Phantom Data check)
        task_uuid = "TASK_UUID_999"
        task_data = {"uuid": task_uuid, "status": "downloading", "progress": 50}
        self.app_state.add_active_task(task_uuid, task_data)
        
        active = self.app_state.get_active_downloads()
        self.assertTrue(any(t['uuid'] == task_uuid for t in active))
        
        # 3. Delete Video while Task is Active
        self.app_state.delete_videos([vid_id])
        
        # Video should be gone
        self.assertIsNone(self.app_state.get_video(vid_id))
        
        # Task should STILL be there (Decoupling success)
        active_after = self.app_state.get_active_downloads()
        match = [t for t in active_after if t['uuid'] == task_uuid]
        self.assertTrue(match, "Active task should persist after unrelated video deletion")
        
        # Cleanup
        self.app_state.remove_active_task(task_uuid)
        # DB deletion is async
        time.sleep(1)
        all_vids_after = db.get_all_videos()
        rows_after = [v for v in all_vids_after if v['id'] == vid_id]
        self.assertFalse(rows_after, "Video should be removed from DB")

if __name__ == '__main__':
    unittest.main()
