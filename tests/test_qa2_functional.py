import sys
import os
from unittest.mock import MagicMock

# Mock wx before importing UI components
mock_wx = MagicMock()
sys.modules['wx'] = mock_wx
sys.modules['wx.grid'] = MagicMock()

class MockGridTableBase:
    def __init__(self): pass
    def GetAttr(self, row, col, kind): return MagicMock()

mock_wx.grid.GridTableBase = MockGridTableBase

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from ui.virtual_table import VirtualVideoTable

def test_qa2_getvalue():
    print("Testing QA2 GetValue refinements...")
    
    data = [{
        'id': 'vid_1',
        'title': 'Test Video',
        'url': 'http://youtube.com/watch?v=1',
        'upload_date': '20240214',
        'added_at': '14/02/2024 16:00:00',
        'status': 'downloading',
        'progress_msg': '50%'
    }, {
        'id': 'vid_2',
        'title': '', # Empty title
        'url': None, # Null URL
        'upload_date': 'invalid_date',
        'added_at': '',
        'status': 'completed'
    }]
    
    col_labels = ["Link", "Título", "Publicado", "Status", "Adicionado"]
    table = VirtualVideoTable(data, col_labels=col_labels)
    
    # Check null/empty handling
    assert table.GetValue(1, 0) == "-", f"Expected '-', got {table.GetValue(1, 0)}"
    assert table.GetValue(1, 1) == "-", f"Expected '-', got {table.GetValue(1, 1)}"
    
    # Check date formatting
    assert table.GetValue(0, 2) == "14/02/2024", f"Expected 14/02/2024, got {table.GetValue(0, 2)}"
    assert table.GetValue(1, 2) == "invalid_date", f"Expected invalid_date, got {table.GetValue(1, 2)}" # Incorrect format should return raw
    
    # Check dynamic status
    assert table.GetValue(0, 3) == "⏳ 50%", f"Expected ⏳ 50%, got {table.GetValue(0, 3)}"
    assert table.GetValue(1, 3) == "COMPLETED", f"Expected COMPLETED, got {table.GetValue(1, 3)}"
    
    print("Functional tests PASSED.")

if __name__ == '__main__':
    test_qa2_getvalue()
