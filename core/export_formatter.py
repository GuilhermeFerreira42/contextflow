# contextflow/core/export_formatter.py
from services.utils import format_duration
import time

class ExportFormatter:
    """
    Centraliza a lógica de formatação para exportações (Markdown/ZIP),
    garantindo consistência visual e de dados.
    """

    @staticmethod
    def get_single_markdown_header() -> str:
        return f"# Exportação ContextFlow\nData: {time.strftime('%Y-%m-%d %H:%M')}\n\n"

    @staticmethod
    def format_video_markdown(video_data: dict, transcript_text: str = None) -> str:
        """
        Gera o conteúdo Markdown para um único vídeo.
        """
        title = video_data.get('title', 'Sem Título')
        url = video_data.get('url', '')
        channel = video_data.get('channel_name') or video_data.get('channel') or '-'
        duration_sec = video_data.get('duration_seconds') or video_data.get('duration')
        
        # Se duration já vier formatada (legacy), tenta parsear ou usa direto se não for int
        # Mas idealmente AppState deve padronizar tudo.
        # Aqui assumimos que pode vir int ou str.
        if isinstance(duration_sec, (int, float)):
             duration_str = format_duration(duration_sec)
        else:
             duration_str = str(duration_sec)

        tokens = video_data.get('token_count', 0)
        summary = video_data.get('summary', '') or video_data.get('summary_text', '')

        md = f"# {title}\n\n"
        md += f"**URL:** {url}\n"
        md += f"**Canal:** {channel}\n"
        md += f"**Duração:** {duration_str}\n"
        md += f"**Tokens:** {tokens}\n"
        
        if summary:
            md += f"\n### Resumo\n{summary}\n"
            
        md += f"\n## Transcrição\n\n"
        md += transcript_text if transcript_text else "(Sem transcrição disponível)"
        md += "\n"
        
        return md

    @staticmethod
    def get_safe_filename(title: str) -> str:
        """
        Sanitiza título para nome de arquivo.
        [COMPATIBILIDADE] Remove caracteres proibidos no Windows (*:? etc) para evitar
        erros de I/O durante exportação em massa.
        """

        return "".join([c for c in title if c.isalnum() or c in (' ', '-', '_')]).strip()
