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
        # [AVISO CRÍTICO DE THREAD] Os Callbacks são executados na Thread do Publisher!
        # Se quem publica é o Processor (Worker Thread), o Callback roda lá.
        # Assinantes de UI DEVEM usar wx.CallAfter.
        if topic in cls._subscribers:
            for cb in cls._subscribers[topic]:
                try:
                    cb(**kwargs) 
                except Exception as e:
                    # Avoid crashing publisher
                    print(f"PubSub Error on topic '{topic}': {e}")
