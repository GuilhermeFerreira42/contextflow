# contextflow/core/metrics.py
import time
from typing import Dict, Any, Optional

class TimeTracker:
    def __init__(self):
        self.start_times: Dict[str, float] = {}
        self.durations: Dict[str, int] = {} # in milliseconds

    def start(self, key: str):
        self.start_times[key] = time.perf_counter()

    def stop(self, key: str):
        if key in self.start_times:
            elapsed = time.perf_counter() - self.start_times[key]
            self.durations[key] = int(elapsed * 1000)
            del self.start_times[key]

    def get_duration(self, key: str) -> int:
        return self.durations.get(key, 0)

    def get_all_metrics(self) -> Dict[str, int]:
        return self.durations

class MetricsCollector:
    """Helper to unify metrics for a specific task."""
    def __init__(self, video_id: str):
        self.video_id = video_id
        self.tracker = TimeTracker()
        self.total_start = time.perf_counter()

    def finalize(self) -> Dict[str, Any]:
        tti = int((time.perf_counter() - self.total_start) * 1000)
        
        metrics = self.tracker.get_all_metrics()
        
        # Calculate overhead: Total TTI - Sum of tracked parts
        # O 'overhead' captura latências não rastreadas, geralmente Renderização de UI ou GC do Python.
        # É crucial para identificar se a lentidão é do modelo (LLM) ou da nossa interface (wxPython).
        tracked_sum = sum(metrics.values())
        overhead = max(0, tti - tracked_sum)

        
        return {
            'video_id': self.video_id,
            'queue_wait_ms': metrics.get('queue_wait', 0),
            'fetch_ms': metrics.get('fetch', 0),
            'llm_processing_ms': metrics.get('llm', 0),
            'ui_render_ms': overhead, # Named ui_render per schema as generic overhead
            'total_tti_ms': tti
        }
