
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

### 📦 Fase 5: UX Avançada de Planilha (Aba Batch/Dados)

**Objetivo:** Transformar a Aba 2 em uma grade interativa e profissional, com foco em manipulação de colunas e leitura de dados.

**Passos de Implementação:**

1. **Células Expansíveis (Resumo/Transcrição):** Implementar o evento de clique duplo para abrir um `RichTextCtrl` ou `TextCtrl` flutuante para leitura de textos longos.
2. **Sistema de Ordenação (Sorting):** Ativar a ordenação por clique no cabeçalho (alfabética, data e duração).
3. **Reordenação por Drag & Drop:** Permitir que o usuário arraste as colunas para mudar sua posição.
4. **Seleção e Cópia Estilo Excel:** Garantir que o `Ctrl+C` capture o conteúdo das células selecionadas mantendo a tabulação.

> **Prompt Sugerido para a IA:**
> "Inicie a **Fase 5: UX Avançada de Planilha**. Foco no arquivo `ui/panel_grid.py`.
> **Requisitos:** > 1. Implemente `EVT_GRID_COL_SORT` para que o clique no cabeçalho ordene os vídeos por título, canal ou data.
> 2. Ative `EnableDragColMove(True)` e garanta que a nova ordem das colunas seja respeitada ao atualizar a grade.
> 3. No evento de clique duplo em células de 'Resumo' ou 'Transcrição', abra um `wx.Dialog` com um campo de texto multilinha para leitura completa.
> 4. Adicione suporte a `Ctrl+C` para copiar os dados selecionados na Grid para a área de transferência."

---

### 📋 User Stories - Fase 6

Entendido! O ajuste faz todo o sentido: a célula expande para dar conforto visual, mas mantém um **limite de altura com scroll interno** para não quebrar a navegação da tabela inteira.

Aqui está a **US01** atualizada com o novo critério de aceite para você registrar:

---

#### **US01 - Leitura Ágil (Expansão e Scroll)**

> **Como** usuário do ContextFlow,
> **quero** dar um duplo clique em uma célula de texto longo para que ela se expanda instantaneamente até um limite confortável com scroll interno,
> **para que** eu possa conferir um detalhe rápido sem precisar mudar de aba ou arrastar bordas manualmente.

* **Critérios de Aceite:**
* O duplo clique deve alternar entre "Tamanho Padrão" e "Tamanho Expandido (Max-Height)".
* O scroll deve ser funcional dentro da célula expandida.
* O comando de "Restaurar Padrões" deve recolher todas as células expandidas.


#### **US02 - Personalização de Visualização (Colunas)**

> **Como** usuário,
> **quero** escolher quais colunas vejo e em qual ordem elas aparecem,
> **para que** eu possa focar apenas nas informações que importam para o meu fluxo de trabalho (ex: ocultar a coluna 'Canal' e priorizar 'Resumo').

* **Critério de Aceite:** O sistema deve salvar a preferência de ordenação e visibilidade durante a sessão.

#### **US03 - Resumo em Lote (Bulk Action)**

> **Como** criador de conteúdo,
> **quero** selecionar vários vídeos e clicar em um único botão "Resumir",
> **para que** eu não precise solicitar o resumo individualmente para cada novo vídeo adicionado.

* **Critério de Aceite:** Deve aparecer um modal de confirmação dizendo: "Resumindo [X] vídeos...". O processo deve ser assíncrono para não travar a interface.

#### **US04 - Gatilho de Resumo Individual (Link Dinâmico)**

> **Como** usuário,
> **quero** clicar diretamente em um link "Clique em Resumir" dentro da tabela,
> **para que** o resumo daquele vídeo específico comece imediatamente sem eu precisar selecionar checkboxes.

* **Critério de Aceite:** A célula deve exibir um estado de "Carregando..." enquanto a IA processa o texto e atualizar automaticamente ao finalizar.

Perfeito, os requisitos ficaram bem mais robustos. Essa US05 agora cobre toda a "memória" e restauração da interface.

Aqui está a atualização da **US05** e a organização das **Ações de Interface**, já prevendo a criação do menu **Exibir** ou o **Menu de Contexto** (botão direito), conforme você sugeriu:

---

### 📋 User Stories - Fase 6 (Atualizada)

#### **US05 - Ordenação, Índice e Restauração de Fábrica**

> **Como** usuário com uma grande biblioteca de vídeos,
> **quero** poder ordenar a tabela por qualquer coluna e ter um índice fixo de adição,
> **para que** eu organize meu estudo e consiga voltar à ordem original de importação sempre que desejar.

* **Critérios de Aceite:**
* **Índice de Adição:** A tabela deve conter uma coluna fixa de ID/Índice (ex: `[#]`) que representa a ordem cronológica em que os vídeos foram inseridos.
* **Ordenação Total:** Todos os cabeçalhos de coluna (Título, Data, Canal, etc.) devem ser clicáveis para ordenar de A-Z ou Z-A.
* **Botão "Restaurar Padrões":** Deve existir uma função que, ao ser acionada, resete simultaneamente:
1. A **ordem** dos vídeos (volta para o índice de adição).
2. A **largura** das colunas para o padrão inicial.
3. A **visibilidade** (exibe todas as colunas ocultas).
4. A **posição** das colunas (caso tenham sido reordenadas via drag-and-drop).

---

## Fase 6: Refinamento de UX, Resumos e Controle de Exibição

Nesta fase, o foco é transformar a aba de conteúdo em uma ferramenta de alta produtividade, permitindo personalização total da visualização e automação de resumos. 

### 1. Visualização Dinâmica e Leitura (UX/UI)

* [ ] **Expansão via Duplo Clique:** Implementar evento de `Double-Click` nas células de "Transcrição" e "Resumo".
* *Ação:* A linha expande instantaneamente para o `max-height` (tamanho máximo configurado).


* [ ] **Scroll Interno Inteligente:** Se o texto for maior que o `max-height` após a expansão, a célula deve habilitar o **scroll vertical**, mantendo o restante da tabela visível.
* [ ] **Navegação para Aba 3:** Manter o comportamento de clique/seleção para abrir a aba dedicada de leitura imersiva.
* [ ] **Reset de Layout Global:** Botão "Restaurar Padrões de Fábrica" para resetar larguras, visibilidade, ordem de colunas e tamanhos de linha.

### 2. Gestão Avançada e Ordenação

* [ ] **Índice de Adição Permanente:** Coluna fixa `[#]` para manter o registro da ordem original de importação.
* [ ] **Engine de Ordenação Multi-coluna:** Cabeçalhos clicáveis para ordenar por qualquer critério, permitindo retornar ao padrão via coluna de Índice.
* [ ] **Menu "Exibir" e Contexto:**
* Menu superior para gerenciar visibilidade de colunas (Checkboxes).
* Menu de contexto (Botão Direito) com opções: "Resumir este vídeo", "Expandir Célula" e "Restaurar Visualização".



### 3. Integração de IA e Automação

* [ ] **Resumo em Lote (Bulk):** Botão "Resumir" no topo processa todos os itens selecionados (com aviso de quantidade).
* [ ] **Link de Ação Rápida:** Célula de resumo vazia exibe "Clique em Resumir" como um gatilho para processar apenas aquela linha.
* [ ] **Atualização Reativa:** O texto do resumo deve "brotar" na célula assim que a IA finalizar, via sinal da thread de processamento.

### 4. Usabilidade e Seleção

* [ ] **Seleção em Massa:** Suporte a `Shift + Clique` e `Ctrl + A`.
* [ ] **Drag-and-Drop:** Reordenação manual das colunas por arraste.

---

### 📦 Fase 7: Personalização e Persistência

**Objetivo:** Permitir que o sistema "lembre" das preferências do usuário e ofereça controle total sobre a interface.

**Passos de Implementação:**

1. **Menu "Exibir > Personalizar Colunas":** Criar um diálogo com checklist para mostrar/ocultar colunas em tempo real.
2. **Persistência (config.json):** Criar um sistema de salvamento para gravar: largura das colunas, ordem das colunas, colunas visíveis e tema (Dark/Light).
3. **Refinamento de Mídia:** Adicionar o fallback de thumbnails e o modal de zoom (Pillow).

> **Prompt Sugerido para a IA:**
> "Implemente a **Fase 6: Personalização e Persistência**.
> **Requisitos:** > 1. Crie um arquivo `storage/config_manager.py` para salvar e carregar preferências em um `config.json`.
> 2. No menu superior, adicione a opção 'Personalizar Colunas' que abre um checklist; a Grid deve atualizar sua visibilidade instantaneamente.
> 3. Garanta que, ao fechar o programa, a largura e a ordem das colunas sejam salvas para a próxima sessão.
> 4. No `youtube_manager.py`, use a biblioteca `Pillow` para converter thumbnails `.webp` para `.png` caso o wxPython falhe no carregamento original."

---

### 📦 Fase 8: Identidade Visual e Dark Mode Global

**Objetivo:** Estética "Productivity Tool" e suporte total a temas escuros.

**Passos de Implementação:**

1. **Motor de Temas:** Criar um dicionário de cores centralizado para Dark e Light mode.
2. **Toggle de Tema:** Adicionar no menu a opção de trocar o tema manualmente ou seguir o sistema operacional.
3. **Simetria de Interface:** Ajustar o padding e o tamanho dos botões da Aba 1 (Dashboard) para que fiquem idênticos aos da Aba 2 (Batch).

> **Prompt Sugerido para a IA:**
> "Finalize com a **Fase 7: Dark Mode e Estilização**.
> **Requisitos:** > 1. Implemente um sistema de temas que altere `COLOR_BG` e `COLOR_FG` em todos os painéis e widgets.
> 2. Padronize os botões 'Processar' e 'Limpar' para o tamanho exato de `(140, 32)`.
> 3. Adicione Tooltips (balões de ajuda) em todos os ícones e botões principais.
> 4. Use `wx.SystemSettings` para detectar se o Windows/Mac está em Dark Mode e aplicar o tema automaticamente na inicialização."

---

### 🛠️ Por que este roteiro funciona?

* **Fase 5** resolve o problema de "leitura" de dados, que é a função principal da sua Aba 2.
* **Fase 6** dá autonomia ao usuário, permitindo que ele configure o software como preferir (especialmente para quem trabalha com muitas colunas).
* **Fase 7** remove o aspecto de "ferramenta técnica" e entrega um produto final polido, pronto para uso profissional.

**Como quer começar?** Recomendo iniciar pela **Fase 5**, pois ela traz o maior ganho de utilidade imediata para quem analisa os dados dos vídeos.