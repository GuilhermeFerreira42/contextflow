# contextflow/ui/components/analysis_context_menu.py
import wx
import webbrowser
from core.pubsub import PubSub

def show_analysis_context_menu(parent, event, video_data):
    """
    Exibe o menu de contexto para a grade analítica.
    [ZERO KNOWLEDGE] Delegado para reduzir tamanho da TabAnalysis.
    """
    row, col = event.GetRow(), event.GetCol()
    vid = video_data.get('id') or video_data.get('uuid')
    title = video_data.get('title', 'Vídeo sem título')
    url = video_data.get('url')
    
    # Foca a linha
    if hasattr(parent, "grid"):
        parent.grid.SetGridCursor(row, col)
    
    menu = wx.Menu()
    m_del = menu.Append(wx.ID_ANY, "🗑️ Excluir")
    m_link = menu.Append(wx.ID_ANY, "🔗 Abrir Link")
    m_copy = menu.Append(wx.ID_ANY, "📋 Copiar Link")
    m_md = menu.Append(wx.ID_ANY, "📄 Baixar como MD")
    m_read = menu.Append(wx.ID_ANY, "📖 Ler (Aba 3)")
    m_sum = menu.Append(wx.ID_ANY, "✨ Resumir")
    
    def on_del(e):
        msg = f"Deseja excluir permanentemente o vídeo:\n'{title}'?"
        if wx.MessageBox(msg, "Confirmar Exclusão", wx.YES_NO | wx.ICON_QUESTION) == wx.YES:
            parent.app_state.delete_videos([vid])

    def on_copy(e):
        if url and wx.TheClipboard.Open():
            wx.TheClipboard.SetData(wx.TextDataObject(url))
            wx.TheClipboard.Close()

    def on_md(e):
        from core.export_formatter import ExportFormatter
        safe_name = ExportFormatter.get_safe_filename(title)
        with wx.FileDialog(parent, "Exportar Markdown", wildcard="Markdown files (*.md)|*.md",
                           defaultFile=f"{safe_name}.md",
                           style=wx.FD_SAVE | wx.FD_OVERWRITE_PROMPT) as fileDialog:
            if fileDialog.ShowModal() != wx.ID_CANCEL:
                path = fileDialog.GetPath()
                from services.export_service import ExportService
                exp = ExportService(parent.app_state)
                exp.export_batch([vid], "markdown_single", path)
                wx.MessageBox("Arquivo exportado com sucesso!", "Sucesso", wx.OK)

    def on_summarize(e):
        video = parent.app_state.get_video(vid)
        if not video: return
        ss = video.get("summary_status")
        if ss == "summarizing":
            wx.MessageBox("Já está sendo resumido.", "Info", wx.OK)
            return
        if ss == "summarized":
            if wx.MessageBox("Gerar novamente?", "Confirmação", wx.YES_NO) != wx.YES:
                return
            parent.app_state.add_or_update_video({"id": vid, "summary_status": None})
        parent.app_state.request_summary(vid)

    parent.Bind(wx.EVT_MENU, on_del, m_del)
    parent.Bind(wx.EVT_MENU, lambda e: webbrowser.open(url) if url else None, m_link)
    parent.Bind(wx.EVT_MENU, on_copy, m_copy)
    parent.Bind(wx.EVT_MENU, on_md, m_md)
    parent.Bind(wx.EVT_MENU, lambda e: PubSub.publish('REQUEST_VIEW_VIDEO', video_id=vid), m_read)
    parent.Bind(wx.EVT_MENU, on_summarize, m_sum)
    
    parent.PopupMenu(menu)
    menu.Destroy()
