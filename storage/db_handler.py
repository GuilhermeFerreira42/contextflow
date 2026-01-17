
# contextflow/storage/db_handler.py
import sqlite3
import os
import datetime
from typing import Dict, Any, List, Optional
from constants import DB_PATH

class DatabaseHandler:
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        self._init_db()
        self._check_and_migrate_db()

    def _get_connection(self):
        return sqlite3.connect(self.db_path)

    def _init_db(self):
        """Cria as tabelas se não existirem."""
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
        
        conn.commit()
        conn.close()

    def _check_and_migrate_db(self):
        """Verifica se as novas colunas existem e as adiciona se necessário."""
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
            cursor.execute('''
                INSERT INTO videos (id, url, title, channel_name, duration, upload_date, thumbnail_path, playlist_id, playlist_title, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    title=excluded.title,
                    channel_name=excluded.channel_name,
                    playlist_id=excluded.playlist_id,
                    playlist_title=excluded.playlist_title,
                    status=excluded.status,
                    thumbnail_path=excluded.thumbnail_path
            ''', (
                video_data['id'],
                video_data['url'],
                video_data.get('title', 'Unknown'),
                video_data.get('channel_name', video_data.get('channel', '')), # Handle both keys
                video_data.get('duration', 0),
                video_data.get('upload_date', ''),
                video_data.get('thumbnail_path', ''),
                video_data.get('playlist_id'),
                video_data.get('playlist_title'),
                video_data.get('status', 'pending'),
                datetime.datetime.now().isoformat()
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
                
            cursor.execute('DELETE FROM videos WHERE playlist_id = ?', (playlist_id,))
            conn.commit()
        except Exception as e:
            print(f"Erro ao deletar playlist {playlist_id}: {e}")
        finally:
            conn.close()
