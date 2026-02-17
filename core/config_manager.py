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
                "proxy_auth": ""
            },
            "orchestration": {
                "max_cloud_tasks": 2,
                "auto_export": False
            },
            "extraction_defense": {
                "cooldown_mins": 10,
                "errors_429_limit": 3,
                "use_cookies": False,
                "use_proxies": False
            },
            "subtitles": {
                "language_order": "pt,pt-BR,en",
                "fallback_auto": True
            },
            "ui": {
                "color_tags": True,
                "dynamic_tags": True
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

    def get_all(self):
        with self._lock:
            return self._config.copy()
