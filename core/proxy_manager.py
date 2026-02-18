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
        self._round_robin_idx = 0
        from core.config_manager import ConfigManager
        self.config = ConfigManager()
        self.hot_reload()
        self._initialized = True

    def hot_reload(self):
        """Atualiza a lista de proxies em memória a partir do arquivo físico."""
        self.proxies = [] # Clear existing
        if not os.path.exists(PROXY_LIST_PATH):
            logger.info(f"Proxy list not found at {PROXY_LIST_PATH}. Starting with empty pool.")
            return
        
        try:
            with open(PROXY_LIST_PATH, 'r', encoding='utf-8') as f:
                self.proxies = [l.strip() for l in f if l.strip()]
            logger.info(f"HOT-RELOAD: {len(self.proxies)} proxies carregados.")
            self._round_robin_idx = 0 # Reset index
        except Exception as e:
            logger.error(f"Failed to hot-reload proxies: {e}")

    def _load_proxies(self):
        # Migrado para hot_reload() para suporte a mudanças em tempo real
        self.hot_reload()

    def get_proxy(self) -> Optional[str]:
        """
        Retorna um proxy seguindo o Modo de Rotação configurado (Aleatório ou Round-Robin).
        """
        now = time.time()
        # Clean expired bans
        self.banned_proxies = {p: t for p, t in self.banned_proxies.items() if t > now}
        
        available = [p for p in self.proxies if p not in self.banned_proxies]
        
        if not available:
            return None
            
        mode = self.config.get("orchestration", "proxy_rotation_mode", "Aleatório")
        
        if mode == "Round-Robin":
            if self._round_robin_idx >= len(available):
                self._round_robin_idx = 0
            proxy = available[self._round_robin_idx]
            self._round_robin_idx = (self._round_robin_idx + 1) % len(available)
            return proxy
        else:
            # Default: Aleatório
            return random.choice(available)

    def ban_proxy(self, proxy: str):
        """Bane um proxy temporariamente após erro 429."""
        if proxy in self.proxies:
            logger.warning(f"Proxy {proxy} banned for {self.ban_duration}s due to error.")
            self.banned_proxies[proxy] = time.time() + self.ban_duration

    def has_proxies(self) -> bool:
        return len(self.proxies) > 0
