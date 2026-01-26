from typing import Callable, Dict, List, Any

class PubSub:
    _subscribers: Dict[str, List[Callable]] = {}

    @classmethod
    def subscribe(cls, topic: str, callback: Callable):
        if topic not in cls._subscribers:
            cls._subscribers[topic] = []
        cls._subscribers[topic].append(callback)

    @classmethod
    def publish(cls, topic: str, **kwargs):
        # Notify all subscribers
        # Note: Callbacks run in the publisher's thread!
        # Subscribers responsible for UI thread safety.
        if topic in cls._subscribers:
            for cb in cls._subscribers[topic]:
                try:
                    cb(**kwargs) 
                except Exception as e:
                    # Avoid crashing publisher
                    print(f"PubSub Error on topic '{topic}': {e}")
