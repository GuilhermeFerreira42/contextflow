import unittest
import os
import sys
import shutil
import zipfile
import threading
from unittest.mock import MagicMock, patch

# Ensure we can import from root
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Mock wx before importing processor
sys.modules['wx'] = MagicMock()
import wx
# Mock CallAfter to just execute the function immediately or pass
def mock_call_after(func, *args, **kwargs):
    func(*args, **kwargs)
wx.CallAfter = mock_call_after

from core.processor import Processor
from services.export_service import ExportService
from core.app_state import AppState

GOLD_STANDARD_PATH = os.path.join(os.path.dirname(__file__), 'gold_standard.zip')
TEST_OUTPUT_PATH = os.path.join(os.path.dirname(__file__), 'test_output.zip')

class TestExportRegression(unittest.TestCase):
    def setUp(self):
        # Setup Mock AppState
        self.mock_app_state = MagicMock(spec=AppState)
        self.mock_db_handler = MagicMock()
        self.mock_app_state.db_handler = self.mock_db_handler
        
        # Create deterministic 5 videos
        self.videos = []
        for i in range(5):
            vid = {
                'id': f'vid_{i}',
                'title': f'Video Title {i}',
                'url': f'http://youtube.com/watch?v=vid_{i}',
                'channel_name': 'Test Channel',
                'duration_seconds': 60 + i,
                'token_count': 100 * i,
                'upload_date': '20230101',
                'playlist_title': 'Test Playlist'
            }
            self.videos.append(vid)
            
        # Mock get_video
        def get_video_side_effect(vid_id):
            for v in self.videos:
                if v['id'] == vid_id:
                    return v
            return None
        self.mock_app_state.get_video.side_effect = get_video_side_effect
        
        # Mock get_transcript
        def get_transcript_side_effect(vid_id):
            return {'full_text': f"Transcript content for {vid_id}.\nLine 2.\nLine 3."}
        self.mock_db_handler.get_transcript.side_effect = get_transcript_side_effect

        # Instantiate ExportService
        self.export_service = ExportService(self.mock_app_state)
    
    def tearDown(self):
        if os.path.exists(TEST_OUTPUT_PATH):
            os.remove(TEST_OUTPUT_PATH)

    def generate_gold_standard(self):
        ids = [v['id'] for v in self.videos]
        print(f"Generating Gold Standard ZIP to {GOLD_STANDARD_PATH}...")
        self.export_service.export_batch(ids, "zip", GOLD_STANDARD_PATH, None)
        print("Done.")

    def test_regression(self):
        if not os.path.exists(GOLD_STANDARD_PATH):
            self.fail("Gold standard ZIP not found. Run this test with 'generate' argument first.")

        ids = [v['id'] for v in self.videos]
        self.export_service.export_batch(ids, "zip", TEST_OUTPUT_PATH, None)
        
        # Compare ZIP contents
        with zipfile.ZipFile(GOLD_STANDARD_PATH, 'r') as gold, zipfile.ZipFile(TEST_OUTPUT_PATH, 'r') as test:
            gold_files = sorted(gold.namelist())
            test_files = sorted(test.namelist())
            
            self.assertEqual(gold_files, test_files, "File list in ZIP differs")
            
            for fname in gold_files:
                with gold.open(fname) as f_gold, test.open(fname) as f_test:
                    self.assertEqual(f_gold.read(), f_test.read(), f"Content of {fname} differs")

if __name__ == '__main__':
    # Simple CLI to generate gold standard
    if len(sys.argv) > 1 and sys.argv[1] == 'generate':
        t = TestExportRegression()
        t.setUp()
        t.generate_gold_standard()
    else:
        unittest.main()
