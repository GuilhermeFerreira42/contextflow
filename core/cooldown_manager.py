# contextflow/core/cooldown_manager.py
import time
import logging
from typing import Optional
from core.app_state import AppState

logger = logging.getLogger("contextflow.cooldown")

class CooldownManager:
    _instance = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super(CooldownManager, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self, app_state: Optional[AppState] = None):
        if self._initialized: return
        self.app_state = app_state or AppState()
        self.db = self.app_state.db_handler
        self._initialized = True

    def trigger_cooldown(self, duration_seconds: int = 3600):
        """Ativa o COOLDOWN global e persiste no DB."""
        expiration = int(time.time() + duration_seconds)
        self.db.set_setting("global_cooldown_until", expiration)
        logger.warning(f"GLOBAL COOLDOWN TRIGGERED! Suspended until {time.strftime('%H:%M:%S', time.localtime(expiration))}")

    def is_cooling_down(self) -> bool:
        """Verifica se o sistema está em período de proteção."""
        now = int(time.time())
        until = self.db.get_setting("global_cooldown_until")
        
        if until and int(until) > now:
            return True
        return False

    def get_remaining_cooldown(self) -> int:
        """Retorna segundos restantes de cooldown ou 0."""
        now = int(time.time())
        until = self.db.get_setting("global_cooldown_until")
        
        if until:
            remaining = int(until) - now
            return max(0, remaining)
        return 0

    def clear_cooldown(self):
        """Remove o cooldown manualmente (uso administrativo/debug)."""
        self.db.set_setting("global_cooldown_until", 0)
        logger.info("Global cooldown cleared.")
