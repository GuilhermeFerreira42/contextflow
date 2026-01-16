
Aqui está o roteiro passo a passo, dividido em **Fases de Implementação**, prontos para você copiar e enviar para a IA.

Esses prompts foram desenhados incorporando as **correções de segurança** (arquitetura anti-bloqueio, UUIDs, Threading) que discutimos para evitar que o sistema quebre.

* * *

### 📦 Fase 1: Blindagem do Core (Arquitetura & Segurança)

**Objetivo:** Preparar o motor (`Processor`) para suportar múltiplas requisições sem travar a UI e sem ser banido pelo YouTube. Implementar UUIDs para rastreamento.

> **Copie e envie este prompt:**
> 
> "Atue como um Engenheiro de Software Sênior em Python/wxPython. Vamos refatorar o núcleo do **ContextFlow** para torná-lo robusto e assíncrono. Use os arquivos `core/processor.py` e `services/youtube_manager.py`.
> 
> **Requisitos Críticos de Mudança:**
> 
> 1.  **Identificador Único (UUID):** Modifique a classe `ProcessingTask` em `processor.py`. Adicione `self.uuid = str(uuid.uuid4())` no `__init__`. O sistema deve usar esse UUID para rastrear a tarefa antes mesmo de termos o `video_id` do YouTube.
>     
> 2.  **Anti-Bloqueio (Jitter):** No método `_worker_loop` do `Processor`, adicione um `time.sleep(random.uniform(2.0, 5.0))` após o processamento bem-sucedido de cada tarefa. Isso evita o erro HTTP 429 (Too Many Requests).
>     
> 3.  **Expansão de Playlist Assíncrona:** O método `add_urls` atualmente bloqueia a UI ao expandir playlists.
>     
>     -   Crie um método interno `_async_add_urls(raw_text)`.
>         
>     -   Mova a lógica de expansão de playlist para este método e execute-o em uma nova `threading.Thread`.
>         
>     -   Este método deve chamar `_enqueue_video` conforme encontra os vídeos.
>         
> 4.  **Novos Eventos de Feedback:** O `Processor` deve disparar eventos granulares via `wx.CallAfter`:
>     
>     -   `on_task_queued(task_uuid, url)`: Disparado IMEDIATAMENTE após validar a URL (antes do download).
>         
>     -   `on_task_started(task_uuid)`: Quando o download começa.
>         
>     -   `on_metadata_fetched(task_uuid, real_video_id, title, ...)`: Quando o ID real é descoberto.
>         
> 
> Por favor, forneça o código refatorado de `core/processor.py` mantendo a compatibilidade com o restante do sistema."

* * *

### 📦 Fase 2: UI Responsiva & Feedback Imediato

**Objetivo:** Conectar a interface gráfica ao novo motor blindado da Fase 1, garantindo que o usuário veja "Na Fila" instantaneamente.

> **Copie e envie este prompt:**
> 
> "Agora vamos atualizar a interface gráfica para responder às mudanças do Core. Foco nos arquivos `ui/panel_grid.py` (ou `panel_excel.py`) e `ui/panel_batch.py`.
> 
> **Requisitos de Implementação:**
> 
> 1.  **Adaptação para UUID:** Atualize o `GridPanel`. O dicionário `self.row_map` agora deve mapear `{row_index: task_uuid}` inicialmente.
>     
>     -   Quando o evento `on_task_queued` chegar, adicione uma linha imediatamente com: Status='Na Fila', Link=URL, Título='Aguardando...'.
>         
>     -   Quando o evento `on_metadata_fetched` chegar, atualize a linha existente (busque pelo UUID) com o Título real e troque a referência interna para o `real_video_id` se necessário.
>         
> 2.  **Checkbox de Clique Único:** Na Grid, intercepte o evento `EVT_GRID_CELL_LEFT_CLICK`. Se o clique for na coluna 0 (Checkbox), inverta o valor ('1'/'0') imediatamente e force um `Refresh()` apenas daquela célula, sem entrar em modo de edição.
>     
> 3.  **Botão Proporcional:** No `ui/panel_batch.py`, remova a flag `wx.EXPAND` do botão 'Processar Fila'. Defina um tamanho fixo (ex: `size=(200, 40)`) para melhorar a estética.
>     
> 4.  **Links Clicáveis:** Capture o clique na coluna de 'Link'. Se o usuário clicar lá, use `webbrowser.open(url)` para abrir no navegador padrão.
>     
> 5.  **Refresh Pós-Exclusão:** Garanta que ao clicar em 'Excluir', o método chame `db_handler.delete_video()` e imediatamente remova a linha da Grid visualmente (`DeleteRows`), sem esperar um refresh total do banco.
>     
> 
> Gere o código atualizado para os componentes de UI."

* * *

### 📦 Fase 3: Dados, Sincronização e Anti-Bloqueio

**Objetivo:** Resolver os erros de download (cookies/transcrição), sincronizar a Sidebar com a Grid e exibir os novos metadados.

> **Copie e envie este prompt:**
> "Estamos na **Fase 3** do projeto. O motor já é assíncrono, mas precisamos resolver erros de download e sincronização de UI. Trabalhe nos arquivos `services/youtube_manager.py`, `ui/panel_grid.py`, `ui/panel_tree.py` e `ui/main_frame.py`.
> **Requisitos de Implementação:**
> 1. **Anti-Bloqueio com Cookies:** No `youtube_manager.py`, implemente o uso de `cookiesfrombrowser('chrome')` (ou seu navegador padrão) na configuração do `yt-dlp`. Isso é essencial para evitar o erro 'Transcrição indisponível' e acessar vídeos de membros.
> 2. **Melhoria na Transcrição:** Se a legenda manual em PT falhar, tente capturar as legendas geradas automaticamente ou em inglês antes de retornar erro.
> 3. **Sincronização Sidebar -> Grid:** No `main_frame.py`, crie uma função de callback `on_data_changed` que chame o `load_data()` da Grid. Passe essa função para o `TreePanel` (Sidebar). Quando um item for deletado ou alterado na Sidebar, ela deve disparar esse callback para atualizar a Grid central automaticamente.
> 4. **Exibição de Metadados:** Adicione as colunas visuais 'Canal' e 'Publicado em' na Grid do `panel_grid.py`. Garanta que elas busquem os dados `channel_name` e `published_at` que já estão sendo salvos no banco.
> 5. **Menu Ferramentas:** Adicione um menu superior chamado '&Ferramentas'. Inclua a opção 'Reprocessar Erros', que deve identificar vídeos com status de erro no banco e reinseri-los na fila de processamento."
> 
> 

---

### 📦 Fase 4: Recursos Avançados de Exportação

**Objetivo:** Implementar downloads em lote (ZIP) e unificação de arquivos sem travar o sistema.

> **Copie e envie este prompt:**
> "Vamos implementar as funcionalidades de exportação da **Fase 4**. Foco em `ui/panel_tree.py` e no gerenciamento de arquivos.
> **Requisitos:**
> 1. **Menu de Contexto (Sidebar):** Adicione ao clique direito nas playlists e vídeos as opções: 'Exportar para ZIP' e 'Exportar como Markdown Único'.
> 2. **Exportação em Streaming:** Ao gerar um Markdown único com muitos vídeos, o sistema deve escrever no arquivo linha por linha (modo append) em vez de carregar tudo na memória RAM.
> 3. **Feedback de Progresso:** Use um `wx.ProgressDialog` para mostrar o avanço da exportação, garantindo que o processo ocorra em uma thread separada para não congelar a interface."
> 
> 

---

### 📦 Fase 5: Refinamento de Mídia e Visualização

**Objetivo:** Melhorar a leitura de textos longos e o tratamento de imagens.

> **Copie e envie este prompt:**
> "Para a **Fase 5**, vamos focar no refinamento da experiência do usuário.
> **Requisitos:**
> 1. **Preview de Transcrição:** Na Grid, ao clicar duas vezes na célula de transcrição, abra um Diálogo (Popup) com scroll para leitura integral do texto, já que a célula da grid é limitada.
> 2. **Tratamento de Imagens (Pillow):** No `youtube_manager.py`, se uma miniatura for baixada em formato `.webp` incompatível, converta-a automaticamente para `.png` usando a biblioteca Pillow para garantir a exibição na interface.
> 3. **Zoom de Miniatura:** Ao clicar em uma miniatura na Grid, abra uma janela flutuante simples exibindo a imagem em tamanho real."
> 
> 

---

### 📦 Fase 6: Estilização e Polimento Final (Opcional)

**Objetivo:** Consistência visual e usabilidade refinada.

> **Copie e envie este prompt:**
> "Esta é a fase final de polimento.
> **Requisitos:**
> 1. **Customização de Cursor:** Altere o cursor do mouse para o tipo 'Mão' (Hand) ao passar sobre colunas que possuem links clicáveis.
> 2. **Cores de Status:** Pinte o texto da coluna 'Status' de acordo com o resultado (Verde para Sucesso, Vermelho para Erro, Amarelo para Na Fila).
> 3. **Logs de Sistema:** Garanta que a aba de Logs no rodapé capture todas as exceções do `yt-dlp` para facilitar o suporte técnico futuro."
> 
>