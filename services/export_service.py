from typing import List, Callable
import zipfile
import logging
from core.app_state import AppState
from core.export_formatter import ExportFormatter

logger = logging.getLogger("contextflow.export")

class ExportService:
    def __init__(self, app_state: AppState):
        self.app_state = app_state

    def export_batch(self, video_ids: List[str], format_type: str, output_path: str, progress_callback: Callable[[int, int, str], None] = None):
        """
        Executa exportação em lote.
        progress_callback: Função (current, total, msg) -> None.
        Nota: O callback deve ser thread-safe (usar wx.CallAfter se tocar na UI).
        """
        total = len(video_ids)
        
        try:
            if format_type == "markdown_single":
                with open(output_path, 'w', encoding='utf-8') as f:
                    f.write(ExportFormatter.get_single_markdown_header())
                    
                    for i, vid in enumerate(video_ids):
                        meta = self.app_state.get_video(vid)
                        if meta:
                            if progress_callback:
                                progress_callback(i, total, f"Exportando: {meta['title']}")
                            
                            # Transcrição completa vem do DB
                            t_data = self.app_state.db_handler.get_transcript(vid)
                            full_text = t_data['full_text'] if t_data else ""
                            
                            md_content = ExportFormatter.format_video_markdown(meta, full_text)
                            f.write(f"---\n\n{md_content}\n")
                            
            elif format_type == "zip":
                 with zipfile.ZipFile(output_path, 'w') as zf:
                    for i, vid in enumerate(video_ids):
                        meta = self.app_state.get_video(vid)
                        if meta:
                            if progress_callback:
                                progress_callback(i, total, f"Compactando: {meta['title']}")
                                
                            t_data = self.app_state.db_handler.get_transcript(vid)
                            full_text = t_data['full_text'] if t_data else ""
                            
                            md_content = ExportFormatter.format_video_markdown(meta, full_text)
                            filename = f"{ExportFormatter.get_safe_filename(meta['title'])}.md"
                            
                            zf.writestr(filename, md_content)
            
            if progress_callback:
                progress_callback(total, total, "Concluído!")
                
        except Exception as e:
            logger.error(f"Export Error: {e}")
            if progress_callback:
                progress_callback(total, total, f"Erro: {str(e)}")
