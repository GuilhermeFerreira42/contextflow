# contextflow/core/config_manager.py
import json
import os
import threading
import logging

logger = logging.getLogger("contextflow.config")

class ConfigManager:
    """
    SINGLETON de Governança de Configurações.
    Gerencia a persistência de credenciais e orquestração em JSON.
    """
    _instance = None
    _lock = threading.RLock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(ConfigManager, cls).__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self):
        if self._initialized:
            return
        
        with self._lock:
            # Caminho absoluto para evitar confusão em diferentes CWDs
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            self.config_path = os.path.join(base_dir, "config", "credentials.json")
            
            self._config = self._get_default_config()
            self._load()
            self._initialized = True

    def _get_default_config(self):
        return {
            "api_keys": {
                "openai": "",
                "anthropic": "",
                "google": "",
                "grok": "",
                "proxy_auth": ""
            },
            "ollama": {
                "endpoint": "http://localhost:11434",
                "model": "llama3"
            },
            "orchestration": {
                "active_provider": "openai",
                "max_cloud_tasks": 2,
                "max_local_tasks": 1,
                "auto_export": False,
                "resume_tasks": True,
                "max_queue_warning": 20,
                "auto_defense_enabled": True,
                "proxy_rotation_mode": "Aleatório"
            },
            "extraction_defense": {
                "cooldown_secs": 3600,
                "errors_429_limit": 5,
                "use_cookies": False,
                "use_proxies": False
            },
            "inputs": {
                "cookie_text": "",
                "proxy_text": ""
            },
            "subtitles": {
                "language_order": "pt,pt-BR,en",
                "fallback_auto": True
            },
            "ui": {
                "color_tags": True,
                "dynamic_tags": True,
                "dynamic_grid": True
            }
        }

    def _load(self):
        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, 'r', encoding='utf-8') as f:
                    loaded = json.load(f)
                    # Deep merge para garantir chaves novas em versões futuras
                    self._merge_config(self._config, loaded)
                logger.info(f"Config carregada de {self.config_path}")
            except Exception as e:
                logger.error(f"Erro ao carregar config: {e}")
        else:
            logger.info("Config não encontrada. Usando padrões e criando arquivo.")
            self.save()

    def _merge_config(self, base, update):
        for key, value in update.items():
            if isinstance(value, dict) and key in base:
                self._merge_config(base[key], value)
            else:
                base[key] = value

    def save(self):
        with self._lock:
            try:
                config_dir = os.path.dirname(self.config_path)
                if not os.path.exists(config_dir):
                    os.makedirs(config_dir)
                
                with open(self.config_path, 'w', encoding='utf-8') as f:
                    json.dump(self._config, f, indent=2, ensure_ascii=False)
                # logger.debug("Config salva com sucesso.")
            except Exception as e:
                logger.error(f"Erro ao salvar config: {e}")

    def get(self, section, key=None, default=None):
        with self._lock:
            section_data = self._config.get(section, {})
            if key is None:
                return section_data
            return section_data.get(key, default)

    def set(self, section, key, value):
        with self._lock:
            if section not in self._config:
                self._config[section] = {}
            self._config[section][key] = value
            self.save()

    def update_physical_files(self):
        """
        Sincroniza os conteúdos de Texto para os arquivos físicos cookies.txt e proxies.txt.
        [GOVERNANÇA] Garante que o motor yt-dlp e o ProxyManager usem dados frescos da UI.
        """
        from constants import BASE_DIR, COOKIES_PATH, PROXY_LIST_PATH
        
        with self._lock:
            # 1. Sincronização de Cookies
            cookie_text = self.get("inputs", "cookie_text", "").strip()
            if cookie_text:
                try:
                    with open(COOKIES_PATH, 'w', encoding='utf-8') as f:
                        f.write(cookie_text)
                    logger.info(f"Cookies físicos atualizados em: {COOKIES_PATH}")
                except Exception as e:
                    logger.error(f"Falha ao escrever cookies.txt: {e}")
            else:
                if os.path.exists(COOKIES_PATH):
                    try:
                        os.remove(COOKIES_PATH)
                        logger.info("cookies.txt removido (vazio na config).")
                    except Exception as e:
                        logger.error(f"Erro ao remover cookies.txt: {e}")

            # 2. Sincronização de Proxies
            proxy_text = self.get("inputs", "proxy_text", "").strip()
            try:
                # Garante que o diretório de proxies exista
                os.makedirs(os.path.dirname(PROXY_LIST_PATH), exist_ok=True)
                with open(PROXY_LIST_PATH, 'w', encoding='utf-8') as f:
                    f.write(proxy_text)
                logger.info(f"Proxies físicos atualizados em: {PROXY_LIST_PATH}")
                
                # Hot-reload instantâneo no singleton
                from core.proxy_manager import ProxyManager
                ProxyManager().hot_reload()
            except Exception as e:
                logger.error(f"Falha ao escrever proxies.txt: {e}")

    def get_all(self):
        with self._lock:
            return self._config.copy()
