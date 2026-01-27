# contextflow/core/proxy_manager.py
import os
import random
import logging
import time
from typing import List, Optional, Dict
from constants import PROXY_LIST_PATH

logger = logging.getLogger("contextflow.proxy")

class ProxyManager:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ProxyManager, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized: return
        self.proxies: List[str] = []
        self.banned_proxies: Dict[str, float] = {} # proxy -> unban_time
        self.ban_duration = 3600 # 1 hour default
        self._load_proxies()
        self._initialized = True

    def _load_proxies(self):
        self.proxies = [] # Clear existing
        if not os.path.exists(PROXY_LIST_PATH):
            logger.info(f"Proxy list not found at {PROXY_LIST_PATH}")
            return
        
        try:
            with open(PROXY_LIST_PATH, 'r') as f:
                self.proxies = [l.strip() for l in f if l.strip()]
            logger.info(f"Loaded {len(self.proxies)} proxies.")
        except Exception as e:
            logger.error(f"Failed to load proxies: {e}")

    def get_proxy(self) -> Optional[str]:
        """Retorna um proxy aleatório da lista de não-banidos."""
        now = time.time()
        # Clean expired bans
        self.banned_proxies = {p: t for p, t in self.banned_proxies.items() if t > now}
        
        available = [p for p in self.proxies if p not in self.banned_proxies]
        
        if not available:
            return None
        
        return random.choice(available)

    def ban_proxy(self, proxy: str):
        """Bane um proxy temporariamente após erro 429."""
        if proxy in self.proxies:
            logger.warning(f"Proxy {proxy} banned for {self.ban_duration}s due to error.")
            self.banned_proxies[proxy] = time.time() + self.ban_duration

    def has_proxies(self) -> bool:
        return len(self.proxies) > 0
