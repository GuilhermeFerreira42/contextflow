# PHASE 5.8 SPECS: Especificações da Aba 1 (Doca de Carga)

> **Status:** SSoT (Fonte Única de Verdade)
> **Alvo:** `ui/tab_batch.py`
> **Estilo:** HeidiSQL / Técnico de Alta Densidade

## 1. Topologia do Layout (Mandatária)

Para garantir a estabilidade exigida e evitar o "vazamento de layout" de fases anteriores, a Aba 1 deve utilizar estritamente um **`wx.BoxSizer` Vertical**. 

* **Interdição:** É terminantemente proibido o uso de `wx.SplitterWindow` nesta aba. Todas as seções devem ser fixas.

### 1.1. Seção de Ingestão (Topo)

* **Título:** "Adicionar URLs".
* **Input:** Área de texto multiline (`wx.TextCtrl`) preparada para colagem em lote de URLs (uma por linha).
* **Botões de Comando:**
    * `delete_sweep` **Limpar:** Esvazia o campo de input.
    * `play_arrow` **Processar Fila:** Inicia a resolução de metadados e enfileiramento no `Processor`.

## 2. Grid de Dados (Centro)

A visualização central deve utilizar a `VirtualVideoTable` para suportar bibliotecas massivas sem degradação de performance.

### 2.1. Definição das 11 Colunas (Ordem SSoT)

A grade deve apresentar as seguintes colunas conforme o padrão de triagem da Fase 5.6:

| # | Rótulo da Coluna | Descrição Técnica |
| :--- | :--- | :--- |
| 1 | **#** | Índice numérico da linha (Referência rápida). |
| 2 | **[x]** | Checkbox para seleção múltipla de itens. |
| 3 | **Thumb** | Miniatura do vídeo (Ícone ou preview de 80x45). |
| 4 | **Título** | Título extraído do vídeo. |
| 5 | **Canal** | Nome do canal/autor. |
| 6 | **Publicado** | Data original de upload (Formato: DD/MM/AAAA). |
| 7 | **Adicionado** | Data de entrada no sistema. |
| 8 | **Playlist** | Título da playlist de origem. |
| 9 | **Duração** | Tempo total (Formato HH:MM:SS). |
| 10 | **Tokens** | Contagem total calculada pela `TokenEngine`. |
| 11 | **Status** | Estado atual: Pendente, Concluído ou ERROR (em vermelho). |

## 3. Barra de Ações Operacionais (Rodapé)

Localizada imediatamente abaixo da Grid, esta barra contém as funções de manipulação em massa para os itens selecionados na coluna `[x]`:

* **🗑️ Excluir:** Remoção física do banco e arquivos locais (thumbnails).
* **📄 Unificar (.md):** Consolidação de múltiplas transcrições em um único arquivo Markdown.
* **📥 Baixar como MD:** Geração de arquivos Markdown individuais com metadados e transcrição.
* **📦 Exportar (ZIP):** Empacotamento das exportações para portabilidade.

## 4. Monitoramento: System Log (Base)

O **System Log** deve estar permanentemente visível na base da Aba 1, integrado via `ConsolePanel`. 

* Deve exibir o timestamp e o nível da mensagem (`INFO`, `WARN`, `ERROR`, `SYSTEM`).
* **Objetivo:** Permitir que o analista identifique bloqueios de rede (Erro 429) ou conclusões de tarefas sem precisar alternar entre abas.

## 5. Requisitos de Performance

* **Scroll:** Deve manter 60 FPS com 10.000 itens usando a virtualização da Grid.
* **Debouncing:** Atualização da grade condicionada ao silêncio de 250ms no barramento de eventos `PubSub`.
