# contextflow/core/managers/finance_manager.py
import sqlite3
import os
import logging
from typing import Dict, Any, List

logger = logging.getLogger("contextflow.finance")

class FinanceManager:
    """
    Gestor do Cofre: Integridade atômica e registro de custos em billing.db.
    Responsável pela governança financeira transacional.
    """
    def __init__(self, db_path: str = "data/billing.db"):
        self.db_path = db_path
        self._ensure_data_dir()
        self._init_db()
        logger.info(f"FinanceManager: Inicializado com {self.db_path}")

    def _ensure_data_dir(self):
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)

    def _init_db(self):
        """Inicializa o banco de cobrança com a tabela de eventos."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS billing_events (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                        video_id TEXT,
                        provider TEXT,
                        model TEXT,
                        input_tokens INTEGER,
                        output_tokens INTEGER,
                        estimated_cost REAL,
                        status TEXT
                    )
                """)
                conn.commit()
        except Exception as e:
            logger.error(f"FinanceManager: Falha ao inicializar DB: {e}")

    def log_transaction(self, video_id: str, provider: str, model: str, 
                        input_tokens: int, output_tokens: int, cost: float, status: str = "COMPLETED"):
        """Registra uma transação financeira de forma atômica."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO billing_events (video_id, provider, model, input_tokens, output_tokens, estimated_cost, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (video_id, provider, model, input_tokens, output_tokens, cost, status))
                conn.commit()
        except Exception as e:
            logger.error(f"FinanceManager: Erro ao registrar transação: {e}")

    def get_total_costs(self) -> float:
        """Calcula o custo total acumulado."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT SUM(estimated_cost) FROM billing_events WHERE status = 'COMPLETED'")
                res = cursor.fetchone()[0]
                return float(res) if res else 0.0
        except Exception as e:
            logger.error(f"FinanceManager: Erro ao ler custos: {e}")
            return 0.0

    def get_token_stats(self) -> Dict[str, int]:
        """Retorna estatísticas de tokens."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT SUM(input_tokens), SUM(output_tokens) FROM billing_events WHERE status = 'COMPLETED'")
                res = cursor.fetchone()
                return {
                    "total_input_tokens": res[0] if res[0] else 0,
                    "total_output_tokens": res[1] if res[1] else 0
                }
        except Exception as e:
            logger.error(f"FinanceManager: Erro ao ler tokens: {e}")
            return {"total_input_tokens": 0, "total_output_tokens": 0}
