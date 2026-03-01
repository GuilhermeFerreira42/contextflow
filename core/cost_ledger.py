# contextflow/core/cost_ledger.py
import sqlite3
import os
import uuid
import datetime
import logging
from typing import Dict, Any, Optional
from constants import BILLING_DB_PATH

logger = logging.getLogger("contextflow.ledger")

class CostLedger:
    """
    Motor Transacional de Governança Financeira (Fase 6.1.1).
    Gerencia o billing.db sob o regime de imutabilidade e atomicidade.
    Atua como o "Cofre" do Analista Solo.
    """
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(CostLedger, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized: return
        self.db_path = BILLING_DB_PATH
        self._init_db()
        self._initialized = True
        logger.info(f"CostLedger inicializado em {self.db_path}")

    def _get_connection(self):
        db_dir = os.path.dirname(self.db_path)
        if not os.path.exists(db_dir):
            os.makedirs(db_dir, exist_ok=True)
        
        conn = sqlite3.connect(self.db_path)
        # Habilita modo WAL para permitir leituras de telemetria sem travar escritas
        conn.execute("PRAGMA journal_mode=WAL")
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        conn = self._get_connection()
        try:
            conn.execute('''
                CREATE TABLE IF NOT EXISTS billing_events (
                    request_id TEXT PRIMARY KEY,
                    timestamp TEXT NOT NULL,
                    provider TEXT NOT NULL,
                    model_id TEXT NOT NULL,
                    tokens_prompt INTEGER NOT NULL,
                    tokens_completion INTEGER NOT NULL,
                    cost_usd REAL NOT NULL,
                    status TEXT NOT NULL,
                    error_code TEXT,
                    latency_ms INTEGER DEFAULT 0
                )
            ''')
            conn.commit()
        finally:
            conn.close()

    def record_transaction(self, meta: Dict[str, Any]) -> str:
        """
        Registra uma transação final de IA.
        Retorna o request_id gerado ou fornecido.
        """
        request_id = meta.get('request_id') or str(uuid.uuid4())
        timestamp = datetime.datetime.now().isoformat()
        
        conn = self._get_connection()
        try:
            # BEGIN IMMEDIATE para evitar "database is locked" em escritas concorrentes
            conn.execute("BEGIN IMMEDIATE")
            conn.execute('''
                INSERT INTO billing_events (
                    request_id, timestamp, provider, model_id, 
                    tokens_prompt, tokens_completion, cost_usd, status, error_code, latency_ms
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                request_id,
                timestamp,
                meta.get('provider', 'unknown'),
                meta.get('model_id', 'unknown'),
                meta.get('tokens_prompt', 0),
                meta.get('tokens_completion', 0),
                meta.get('cost_usd', 0.0),
                meta.get('status', 'success'),
                meta.get('error_code'),
                meta.get('latency_ms', 0)
            ))
            conn.commit()
            logger.info(f"Transação {request_id} registrada: ${meta.get('cost_usd', 0.0)}")
            return request_id
        except Exception as e:
            conn.rollback()
            logger.error(f"Erro ao registrar transação no ledger: {e}")
            raise
        finally:
            conn.close()

    def get_session_total(self) -> float:
        """Retorna o custo total registrado na sessão (ou período atual)."""
        conn = self._get_connection()
        try:
            row = conn.execute("SELECT SUM(cost_usd) FROM billing_events WHERE status = 'success'").fetchone()
            return row[0] if row and row[0] else 0.0
        finally:
            conn.close()

    def get_last_transaction(self) -> Optional[Dict[str, Any]]:
        """Retorna o snapshot da última transação bem sucedida para a TelemetryStrip."""
        conn = self._get_connection()
        try:
            row = conn.execute("SELECT * FROM billing_events ORDER BY timestamp DESC LIMIT 1").fetchone()
            return dict(row) if row else None
        finally:
            conn.close()
