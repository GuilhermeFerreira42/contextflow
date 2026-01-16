
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

### 📦 Fase 3: Dados & Metadados (Médio Prazo)

**Objetivo:** Expandir o banco de dados sem quebrar versões antigas e capturar mais informações (Canal, Datas).

> **Copie e envie este prompt:**
> 
> "Vamos evoluir a camada de dados e extração. Trabalhe em `storage/db_handler.py` e `services/youtube_manager.py`.
> 
> **Requisitos de Implementação:**
> 
> 1.  **Migração Robusta de Schema:** No `db_handler.py`, melhore o método `_check_and_migrate_db`.
>     
>     -   Verifique se as colunas `channel_name`, `published_at` e `added_at` existem.
>         
>     -   Se não existirem, execute `ALTER TABLE` adicionando-as com valores `DEFAULT` seguros (ex: NULL ou string vazia) para não corromper dados existentes.
>         
> 2.  **Extração de Metadados:** No `youtube_manager.py`, atualize `get_video_metadata` para extrair:
>     
>     -   `uploader` (para channel\_name).
>         
>     -   `upload_date` (formatar para YYYY-MM-DD se possível).
>         
> 3.  **Persistência:** Atualize o método `add_video_entry` no DB Handler para salvar esses novos campos.
>     
> 4.  **Atualização da Tabela:** No `ui/panel_table.py` (ou onde os dados são exibidos), adicione as colunas visuais para 'Canal' e 'Data'. Garanta que o renderizador trate valores `None` (de vídeos antigos) exibindo um traço '-' para evitar erros de string.
>     
> 
> Forneça as classes atualizadas focando na integridade dos dados."

* * *

### 📦 Fase 4: Recursos Avançados & Exportação (Médio/Longo Prazo)

**Objetivo:** Permitir downloads complexos sem estourar a memória RAM (Exportação em Streaming).

> **Copie e envie este prompt:**
> 
> "Implemente funcionalidades avançadas de exportação e menu de contexto. Arquivos: `ui/sidebar.py`, `core/processor.py` e `ui/panel_grid.py`.
> 
> **Requisitos:**
> 
> 1.  **Menu de Contexto:** Na `Sidebar`, adicione opções ao clicar com botão direito em um vídeo ou playlist:
>     
>     -   'Baixar ZIP'
>         
>     -   'Exportar Markdown Unificado'
>         
> 2.  **Exportação Otimizada (Streaming):** No `Processor` (ou numa nova classe `ExportManager`), reescreva a lógica de exportação 'Unificada'.
>     
>     -   **NÃO** carregue todo o conteúdo na RAM.
>         
>     -   Abra o arquivo de destino `.md` e escreva vídeo por vídeo iterativamente (append), limpando a memória a cada iteração. Isso previne crash por falta de memória em grandes listas.
>         
> 3.  **Thread de Exportação:** A exportação deve rodar em uma `threading.Thread` separada para não congelar a interface enquanto gera o ZIP ou MD. Mostre um `wx.ProgressDialog` indeterminado enquanto processa.
>     
> 
> Gere o código necessário para essas funcionalidades."

* * *

### 📦 Fase 5: Refinamento Visual & Mídia (Longo Prazo)

**Objetivo:** Tratamento profissional de imagens e visualização de texto.

> **Copie e envie este prompt:**
> 
> "Para finalizar, vamos refinar o tratamento de mídia e usabilidade visual.
> 
> **Requisitos:**
> 
> 1.  **Visualização Rápida (Preview):** Na Grid de dados, implemente um 'Tooltip' rico ou um evento de clique duplo na célula de Transcrição.
>     
>     -   Ao acionar, abra uma janela `wx.PopupTransientWindow` ou um `Dialog` simples mostrando o texto completo (com scroll), já que a célula da grid não suporta textos longos.
>         
> 2.  **Validação de Imagens (Robustez):** No `YouTubeManager` (download de thumb) e na UI (carregamento):
>     
>     -   Adicione validação usando a biblioteca `Pillow` (se disponível).
>         
>     -   Se a imagem baixada for `.webp` ou estiver corrompida, tente convertê-la para `.png` antes de salvar.
>         
>     -   Na UI, se `wx.Image` falhar ao carregar, capture a exceção silenciosamente e exiba um placeholder cinza, evitando crashes.
>         
> 3.  **Zoom de Imagem:** Ao clicar na miniatura na tabela, abra um `wx.Frame` flutuante sem bordas exibindo a imagem em tamanho real. O frame deve fechar ao perder o foco.
>     
> 
> Forneça as modificações para `ui/panel_detail.py` e `services/youtube_manager.py`."