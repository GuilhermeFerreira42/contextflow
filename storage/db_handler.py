
# contextflow/storage/db_handler.py
import sqlite3
import os
import datetime
from typing import Dict, Any, List, Optional
from constants import DB_PATH

class DatabaseHandler:
    def __init__(self, db_path: str = DB_PATH):
        # [ROBUSTEZ] Normalização absoluta do caminho para evitar erros em threads/CWDs variados
        self.db_path = os.path.abspath(db_path)
        self._init_db()
        self._check_and_migrate_db()

    def _get_connection(self):
        # [FIX] Garante que o diretório existe antes de tentar abrir
        db_dir = os.path.dirname(self.db_path)
        if not os.path.exists(db_dir):
            os.makedirs(db_dir, exist_ok=True)
        return sqlite3.connect(self.db_path)

    def _init_db(self):
        """Cria as tabelas se não existirem."""
        db_dir = os.path.dirname(self.db_path)
        if db_dir:
            os.makedirs(db_dir, exist_ok=True)
        conn = self._get_connection()
        cursor = conn.cursor()
        
        # Tabela de Vídeos (Metadados)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS videos (
                id TEXT PRIMARY KEY,
                url TEXT NOT NULL,
                title TEXT,
                channel_name TEXT,
                duration INTEGER,
                upload_date TEXT,
                thumbnail_path TEXT, 
                playlist_id TEXT,
                playlist_title TEXT,
                token_count INTEGER DEFAULT 0,
                status TEXT DEFAULT 'pending', 
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                added_at TEXT
            )
        ''')

        # Tabela de Transcrições (Conteúdo Pesado)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS transcripts (
                video_id TEXT PRIMARY KEY,
                full_text TEXT,
                summary TEXT,
                FOREIGN KEY (video_id) REFERENCES videos(id)
            )
        ''')

        # Tabela ai_usage_log (Auditabilidade Financeira)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS ai_usage_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                video_id TEXT, -- Relacionamento fraco (sem FK restritiva)
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                model_name TEXT NOT NULL,
                provider TEXT NOT NULL,
                input_hash TEXT NOT NULL,
                prompt_checksum TEXT NOT NULL,
                input_tokens INTEGER NOT NULL,
                output_tokens INTEGER NOT NULL,
                estimated_cost REAL NOT NULL,
                actual_cost REAL,
                billing_period TEXT NOT NULL,
                queue_wait_ms INTEGER,
                fetch_ms INTEGER,
                llm_processing_ms INTEGER,
                ui_render_ms INTEGER,
                total_tti_ms INTEGER,
                status TEXT NOT NULL
            )
        ''')

        # Tabela ai_cache (Eficiência Operacional)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS ai_cache (
                hash_key TEXT PRIMARY KEY,
                response_json TEXT NOT NULL,
                prompt_checksum TEXT NOT NULL,
                model_version TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Tabela system_config (Persistência de Estados e Configurações)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS system_config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_ai_log_hash ON ai_usage_log(input_hash)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_ai_log_video ON ai_usage_log(video_id)')
        
        conn.commit()
        conn.close()

    def _check_and_migrate_db(self):
        """
        Verifica se as novas colunas existem e as adiciona se necessário.
        [MANUTENÇÃO ZERO] 'Auto-Migrate' via PRAGMA table_info.
        Evita a necessidade de ferramentas complexas (Alembic) para um app desktop simples.
        """

        conn = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("PRAGMA table_info(videos)")
            columns = [info[1] for info in cursor.fetchall()]
            
            if 'playlist_id' not in columns:
                print("Migrando DB: Adicionando playlist_id...")
                cursor.execute("ALTER TABLE videos ADD COLUMN playlist_id TEXT")
                
            if 'playlist_title' not in columns:
                print("Migrando DB: Adicionando playlist_title...")
                cursor.execute("ALTER TABLE videos ADD COLUMN playlist_title TEXT")

            if 'channel_name' not in columns:
                print("Migrando DB: Adicionando channel_name...")
                cursor.execute("ALTER TABLE videos ADD COLUMN channel_name TEXT")

            if 'added_at' not in columns:
                print("Migrando DB: Adicionando added_at...")
                cursor.execute("ALTER TABLE videos ADD COLUMN added_at TEXT")
                
            conn.commit()
        except Exception as e:
            print(f"Erro na migração de DB: {e}")
        finally:
            conn.close()

    def add_video_entry(self, video_data: Dict[str, Any]):
        """Insere ou atualiza um registro de vídeo."""
        conn = self._get_connection()
        cursor = conn.cursor()
        try:
            # created_at is NOT updated on conflict regarding requirement
            cursor.execute('''
                INSERT INTO videos (id, url, title, channel_name, duration, upload_date, thumbnail_path, playlist_id, playlist_title, status, created_at, added_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    title=excluded.title,
                    channel_name=excluded.channel_name,
                    playlist_id=excluded.playlist_id,
                    playlist_title=excluded.playlist_title,
                    status=excluded.status,
                    thumbnail_path=excluded.thumbnail_path,
                    duration=excluded.duration
                    -- created_at e added_at NÃO são atualizados
            ''', (
                video_data['id'],
                video_data['url'],
                video_data.get('title', 'Unknown'),
                video_data.get('channel_name', video_data.get('channel', '')), 
                # Salva duration formatada ou raw? O ideal é salvar raw se possível, mas aqui estamos mantendo compatibilidade
                # Se vier 'duration' formatado (str), salva. Se vier int, formata?
                # O youtube_manager manda formatado em 'duration'.
                # Vamos salvar o que vier em 'duration'.
                video_data.get('duration', 0),
                video_data.get('upload_date', ''),
                video_data.get('thumbnail_path', ''),
                video_data.get('playlist_id'),
                video_data.get('playlist_title'),
                video_data.get('status', 'pending'),
                # created_at (novo registro)
                datetime.datetime.now().isoformat(),
                # added_at (novo registro) - Se vier no video_data, usa, senão usa agora
                video_data.get('added_at') or datetime.datetime.now().strftime("%d/%m/%Y %H:%M:%S")
            ))
            conn.commit()
        except Exception as e:
            print(f"DB Error (add_video): {e}")
        finally:
            conn.close()

    def update_video_status(self, video_id: str, status: str, token_count: int = None):
        conn = self._get_connection()
        cursor = conn.cursor()
        try:
            if token_count is not None:
                cursor.execute('UPDATE videos SET status = ?, token_count = ? WHERE id = ?', (status, token_count, video_id))
            else:
                cursor.execute('UPDATE videos SET status = ? WHERE id = ?', (status, video_id))
            conn.commit()
        finally:
            conn.close()

    def save_transcript(self, video_id: str, text: str, summary: str = ""):
        conn = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute('''
                INSERT INTO transcripts (video_id, full_text, summary)
                VALUES (?, ?, ?)
                ON CONFLICT(video_id) DO UPDATE SET
                    full_text=excluded.full_text,
                    summary=excluded.summary
            ''', (video_id, text, summary))
            conn.commit()
        finally:
            conn.close()

    def get_all_videos(self) -> List[Dict[str, Any]]:
        conn = self._get_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        try:
            # JOIN para pegar metadados + snippet da transcrição + resumo
            # Usando LEFT JOIN para garantir que videos sem transcrição apareçam
            query = '''
                SELECT 
                    v.*, 
                    substr(t.full_text, 1, 100) as transcript_snippet,
                    t.summary as summary_text
                FROM videos v
                LEFT JOIN transcripts t ON v.id = t.video_id
                ORDER BY v.created_at DESC
            '''
            cursor.execute(query)
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        finally:
            conn.close()

    def get_transcript(self, video_id: str) -> Optional[Dict[str, Any]]:
        conn = self._get_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        try:
            cursor.execute('SELECT * FROM transcripts WHERE video_id = ?', (video_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    def delete_video(self, video_id: str):
        import os
        conn = self._get_connection()
        conn.row_factory = sqlite3.Row # Ensure we can access col names
        cursor = conn.cursor()
        try:
            # 1. Obter caminho da thumbnail antes de deletar
            cursor.execute('SELECT thumbnail_path FROM videos WHERE id = ?', (video_id,))
            row = cursor.fetchone()
            if row and row['thumbnail_path']:
                thumb_path = row['thumbnail_path']
                if os.path.exists(thumb_path):
                    try:
                        os.remove(thumb_path)
                        # print(f"Arquivo deletado: {thumb_path}")
                    except Exception as ex:
                        print(f"Erro ao deletar arquivo {thumb_path}: {ex}")

            # Transcripts tem FK, mas vamos garantir
            cursor.execute('DELETE FROM transcripts WHERE video_id = ?', (video_id,))
            cursor.execute('DELETE FROM videos WHERE id = ?', (video_id,))
            conn.commit()
        except Exception as e:
            print(f"Erro ao deletar video {video_id}: {e}")
        finally:
            conn.close()

    def get_video_ids_for_playlist(self, playlist_id: str) -> List[str]:
        """Retorna lista de IDs de vídeo para uma dada playlist."""
        conn = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute('SELECT id FROM videos WHERE playlist_id = ?', (playlist_id,))
            rows = cursor.fetchall()
            return [r[0] for r in rows]
        finally:
            conn.close()

    def delete_playlist(self, playlist_id: str):
        import os
        conn = self._get_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        try:
            # 1. Pegar IDs e Thumbs para limpar
            cursor.execute('SELECT id, thumbnail_path FROM videos WHERE playlist_id = ?', (playlist_id,))
            rows = cursor.fetchall()
            
            vids = []
            for r in rows:
                vids.append(r['id'])
                t_path = r['thumbnail_path']
                if t_path and os.path.exists(t_path):
                    try:
                        os.remove(t_path)
                    except: pass
            
            if vids:
                placeholders = ','.join(['?'] * len(vids))
                cursor.execute(f'DELETE FROM transcripts WHERE video_id IN ({placeholders})', vids)
                
            conn.commit()
        except Exception as e:
            print(f"Erro ao deletar playlist {playlist_id}: {e}")
        finally:
            conn.close()

    def delete_orphaned_videos(self):
        """Remove todos os vídeos que NÃO pertencem a uma playlist."""
        import os
        conn = self._get_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        try:
            # 1. Pegar IDs e Thumbs
            cursor.execute('SELECT id, thumbnail_path FROM videos WHERE playlist_id IS NULL OR playlist_id = ""')
            rows = cursor.fetchall()
            
            vids = []
            for r in rows:
                vids.append(r['id'])
                t_path = r['thumbnail_path']
                if t_path and os.path.exists(t_path):
                    try:
                        os.remove(t_path)
                    except: pass
            
            if vids:
                placeholders = ','.join(['?'] * len(vids))
                cursor.execute(f'DELETE FROM transcripts WHERE video_id IN ({placeholders})', vids)
                cursor.execute(f'DELETE FROM videos WHERE id IN ({placeholders})', vids)
                conn.commit()
            return vids
        except Exception as e:
            print(f"Erro ao deletar orfãos: {e}")
            return []
        finally:
            conn.close()

    # --- AI Governance Extensions ---

    def log_ai_usage(self, usage_data: Dict[str, Any]):
        """Registra uma entrada de uso de IA para auditoria."""
        conn = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute('''
                INSERT INTO ai_usage_log (
                    video_id, model_name, provider, input_hash, prompt_checksum,
                    input_tokens, output_tokens, estimated_cost, actual_cost, billing_period,
                    queue_wait_ms, fetch_ms, llm_processing_ms, ui_render_ms, total_tti_ms, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                -- [INTEGRIDADE FINANCEIRA] O relacionamento com 'video_id' é fraco (sem FK restritiva).
                -- Isso garante que o log de custo persista para auditoria mesmo que o usuário delete o vídeo.

            ''', (
                usage_data.get('video_id'),
                usage_data.get('model_name'),
                usage_data.get('provider'),
                usage_data.get('input_hash'),
                usage_data.get('prompt_checksum'),
                usage_data.get('input_tokens', 0),
                usage_data.get('output_tokens', 0),
                usage_data.get('estimated_cost', 0.0),
                usage_data.get('actual_cost'),
                usage_data.get('billing_period'),
                usage_data.get('queue_wait_ms'),
                usage_data.get('fetch_ms'),
                usage_data.get('llm_processing_ms'),
                usage_data.get('ui_render_ms'),
                usage_data.get('total_tti_ms'),
                usage_data.get('status')
            ))
            conn.commit()
        except Exception as e:
            print(f"DB Error (log_ai_usage): {e}")
        finally:
            conn.close()

    def get_ai_cache(self, hash_key: str) -> Optional[Dict[str, Any]]:
        """Busca resposta no cache de IA."""
        conn = self._get_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        try:
            cursor.execute('SELECT * FROM ai_cache WHERE hash_key = ?', (hash_key,))
            row = cursor.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    def save_ai_cache(self, hash_key: str, response_json: str, prompt_checksum: str, model_version: str):
        """Salva uma resposta no cache de IA."""
        conn = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute('''
                INSERT INTO ai_cache (hash_key, response_json, prompt_checksum, model_version)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(hash_key) DO UPDATE SET
                    response_json=excluded.response_json,
                    prompt_checksum=excluded.prompt_checksum,
                    model_version=excluded.model_version,
                    created_at=CURRENT_TIMESTAMP
            ''', (hash_key, response_json, prompt_checksum, model_version))
            conn.commit()
        except Exception as e:
            print(f"DB Error (save_ai_cache): {e}")
        finally:
            conn.close()

    def set_setting(self, key: str, value: Any):
        """Salva uma configuração no banco."""
        conn = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute('''
                INSERT INTO system_config (key, value) VALUES (?, ?)
                ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP
            ''', (key, str(value)))
            conn.commit()
        finally:
            conn.close()

    def get_setting(self, key: str) -> Optional[str]:
        """Busca uma configuração no banco."""
        conn = self._get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute('SELECT value FROM system_config WHERE key = ?', (key,))
            row = cursor.fetchone()
            return row[0] if row else None
        finally:
            conn.close()
