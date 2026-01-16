
# contextflow/ui/app_window.py
import wx
import threading
import os
from constants import APP_NAME, APP_VERSION
from core.token_engine import get_encoder_info

# Real implementations
from ui.panel_grid import GridPanel
from ui.panel_detail import DetailPanel
from ui.panel_console import ConsolePanel
from ui.sidebar import Sidebar
from ui.panel_table import PanelTable
from storage.db_handler import DatabaseHandler

class AppWindow(wx.Frame):
    def __init__(self, parent, title=f"{APP_NAME} v{APP_VERSION}"):
        super().__init__(parent, title=title, size=(1280, 850))
        
        self.db_handler = DatabaseHandler()
        self._init_ui()
        self.Maximize() # Inicia maximizado
        self.Show(True)
        
        # Log inicial
        self.panel_console.log("Sistema iniciado. Pronto.", "SYSTEM")

    def _init_ui(self):
        # 1. Main Splitter (Vertical: Sidebar | Workspace+Console)
        self.main_splitter = wx.SplitterWindow(self, style=wx.SP_BORDER | wx.SP_LIVE_UPDATE)
        
        # 1.1 Sidebar (Left)
        self.sidebar = Sidebar(self.main_splitter, self.on_sidebar_selection, self.on_sidebar_data_changed)

        # 1.2 Right Area Container (will be a Splitter too)
        self.right_splitter = wx.SplitterWindow(self.main_splitter, style=wx.SP_BORDER | wx.SP_LIVE_UPDATE)
        
        # 2. Workspace (Top Right) - Notebook
        self.notebook = wx.Notebook(self.right_splitter)
        
        # 3. Console (Bottom Right)
        self.panel_console = ConsolePanel(self.right_splitter)
        
        # 4. Criar Abas do Notebook
        # Aba 1: Grid de Dados
        # Passamos self.log_to_console como callback
        self.panel_grid = GridPanel(self.notebook, 
                                    on_data_changed=self.on_grid_data_changed,
                                    log_callback=self.log_to_console)
        
        # Aba 2: Tabela: Vídeos (Nova Aba)
        self.panel_table = PanelTable(self.notebook, on_selection_callback=self.on_table_selection)
        
        # Aba 3: Detalhes / Conteúdo
        self.panel_detail = DetailPanel(self.notebook)
        
        self.notebook.AddPage(self.panel_grid, "Dados (Batch)")
        self.notebook.AddPage(self.panel_table, "Tabela: Vídeos")
        self.notebook.AddPage(self.panel_detail, "Conteúdo (Leitura)")

        # Configurar Splitters
        # Right Splitter: Top (Notebook) vs Bottom (Console)
        self.right_splitter.SplitHorizontally(self.notebook, self.panel_console, -150) # 150px altura console
        self.right_splitter.SetSashGravity(1.0) # Ao redimensionar janela, console fica fixo em baixo
        self.right_splitter.SetMinimumPaneSize(100)
        
        # Main Splitter: Left (Sidebar) vs Right (Splitter2)
        self.main_splitter.SplitVertically(self.sidebar, self.right_splitter, 250) # 250px largura sidebar
        self.main_splitter.SetMinimumPaneSize(150)

        # 5. Menus e Toolbar
        self.create_menubar()
        
    def create_menubar(self):
        menubar = wx.MenuBar()
        file_menu = wx.Menu()
        file_menu.Append(wx.ID_EXIT, "Sair", "Encerrar aplicação")
        menubar.Append(file_menu, "&Arquivo")
        self.SetMenuBar(menubar)
        
        self.Bind(wx.EVT_MENU, self.on_exit, id=wx.ID_EXIT)
        self.Bind(wx.EVT_CLOSE, self.on_close)

        # View Menu
        view_menu = wx.Menu()
        self.item_view_logs = view_menu.AppendCheckItem(2001, "Exibir Logs/Console")
        self.item_view_logs.Check(True) # Default True
        menubar.Append(view_menu, "&Exibir")
        
        self.Bind(wx.EVT_MENU, self.on_toggle_logs, id=2001)

        # Tools Menu
        tools_menu = wx.Menu()
        tools_menu.Append(3001, "Reprocessar Erros", "Tenta baixar novamente vídeos com status de erro")
        menubar.Append(tools_menu, "&Ferramentas")
        
        self.Bind(wx.EVT_MENU, self.on_reprocess_errors, id=3001)

    # --- Callbacks e Lógica ---

    def on_toggle_logs(self, event):
        show = self.item_view_logs.IsChecked()
        if show:
            self.panel_console.Show()
            self.right_splitter.SplitHorizontally(self.notebook, self.panel_console, -150)
        else:
            self.panel_console.Hide()
            self.right_splitter.Unsplit(self.panel_console)
        self.right_splitter.Layout()

    def log_to_console(self, msg, level="INFO"):
        self.panel_console.log(msg, level)

    def on_sidebar_selection(self, video_id):
        """Ao selecionar na árvore, focar na aba de Leitura e carregar."""
        # Carrega dados
        video_meta = None
        all_v = self.db_handler.get_all_videos() 
        for v in all_v:
            if v['id'] == video_id:
                video_meta = v
                break
        
        transcript_data = self.db_handler.get_transcript(video_id)
        
        if video_meta and transcript_data:
            self.panel_detail.load_video(video_meta, transcript_data['full_text'])
            # Muda para a aba de conteúdo
            self.notebook.SetSelection(1)
            self.log_to_console(f"Visualizando: {video_meta.get('title')}", "NAV")

    def on_grid_data_changed(self):
        """Chamado quando o GridPanel recebe novos dados/processamento."""
        self.sidebar.load_history()
        self.panel_table.load_data() # Update table as well

    def on_table_selection(self, video_id):
        # Reuse logic
        self.on_sidebar_selection(video_id)

    def on_sidebar_data_changed(self):
        """Called when data is deleted from Sidebar."""
        self.panel_grid.load_data()
        self.panel_table.load_data()

    def on_exit(self, event):
        self.Close()
        
    def on_close(self, event):
        if hasattr(self.panel_grid, 'processor') and self.panel_grid.processor:
            self.panel_grid.processor.stop_processing()
        event.Skip()

    def on_reprocess_errors(self, event):
        """Busca vídeos com erro no DB e re-enfileira."""
        # Obter IDs com erro
        conn = self.db_handler._get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT url FROM videos WHERE status='ERROR'")
        rows = cursor.fetchall()
        conn.close()
        
        if not rows:
            wx.MessageBox("Nenhum vídeo com erro encontrado.", "Info")
            return
            
        urls = [r[0] for r in rows]
        confirm = wx.MessageBox(f"Encontrados {len(urls)} vídeos com erro. Deseja tentar novamente?", "Confirmação", wx.YES_NO | wx.ICON_QUESTION)
        
        if confirm == wx.YES:
            # Join URLs
            text_block = "\n".join(urls)
            # Envia para o processador (via GridPanel que tem a instância)
            self.panel_grid.txt_input.SetValue(text_block)
            self.panel_grid.on_click_process(None)
            self.log_to_console(f"Reiniciando processamento de {len(urls)} itens.", "SYSTEM")
