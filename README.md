# Product Requirements Document (PRD) - ContextFlow

## 1. Visão Geral do Produto

*   **Nome do Projeto:** ContextFlow
*   **Versão Atual:** 0.1.0 (Inferido de [constants.py](file:///c:/Users/Usuario/Desktop/pro/contextflow/constants.py))
*   **Slogan:** "*Transforme vídeos e arquivos brutos em contexto acionável para LLMs.*"
*   **Missão:** Simplificar a extração, limpeza e quantificação de dados (vídeos do YouTube e arquivos locais) para uso em fluxos de Inteligência Artificial, oferecendo uma interface desktop robusta e focada em produtividade.
*   **Personas:**
    *   **"Ana, a Engenheira de Prompt":** Precisa transcrever 50 vídeos de uma playlist, limpar o lixo (timestamps/intro) e saber exatamente quantos tokens isso vai custar antes de enviar para o GPT-4.
    *   **"Marcos, o Pesquisador de Dados":** Precisa de um banco de dados local pesquisável de conteúdos de vídeo sem depender de APIs instáveis ou interfaces web lentas.
*   **Diferenciais:**
    *   Foco em **Tokens** (Moeda da IA) e não apenas tempo.
    *   Processamento em Batch (Lote) real com *thread* de fundo.
    *   Interface Desktop Nativa (alta densidade de informação) vs Web Apps lentos.
    *   Armazenamento SQLite Local (Privacidade e Persistência).

---

## 2. Arquitetura de Alto Nível e Escolhas Tecnológicas

### Fluxo de Dados (Pipeline Principal)

```mermaid
graph TD
    User["Usuário"] -->|Cola URLs (Batch)| UI_Batch["UI: BatchPanel"]
    UI_Batch -->|Enfileira| Processor["Core: Processor (Thread)"]
    
    subgraph Core System
        Processor -->|Fetch Metadata| YT_Mgr["Service: YouTubeManager"]
        YT_Mgr -->|yt-dlp / Requests| YouTube["YouTube (External)"]
        
        Processor -->|Clean Text| YT_Mgr
        Processor -->|Count Tokens| TokenEng["Core: TokenEngine"]
        
        Processor -->|Persist Data| DB["Storage: DatabaseHandler"]
        DB -->|SQL| SQLite[("contextflow.db")]
        DB -->|Save Img| FS_Thumbs["FileSys: /data/thumbs"]
    end
    
    DB -->|Read Data| UI_Excel["UI: ExcelPanel (Grid)"]
    DB -->|Read Details| UI_Detail["UI: DetailPanel"]
    
    subgraph Features "Dormant (Future)"
        Scanner["Core: Scanner"]
        Tree["Core: TreeLogic"]
    end
```

### Stack Tecnológico

| Tecnologia | Função no Projeto | Por que foi escolhida? |
| :--- | :--- | :--- |
| **Python 3.11+** | Linguagem Core | Ecossistema rico para IA (`tiktoken`) e processamento de dados. |
| **wxPython** | Interface Gráfica (GUI) | Widgets nativos de OS, performance superior a Electron para grids pesadas, visual clássico de ferramenta "Pro". |
| **SQLite3** | Banco de Dados | Zero config, arquivo único local, perfeito para apps desktop single-user. |
| **yt-dlp** | Extração de Vídeo | A biblioteca mais robusta e atualizada para engenharia reversa do YouTube. |
| **Tiktoken** | Tokenização | Contagem exata de tokens BPE (padrão OpenAI) para estimativas precisas. |
| **Threading** | Concorrência | Mantém a UI responsiva enquanto processa downloads pesados em background. |

---

## 3. Árvore de Diretórios e Esqueleto

```text
contextflow/
├── main.py                  # Ponto de entrada. Bootstraps wx.App e AppWindow.
├── constants.py             # Configurações globais (Caminhos, Cores, Versão).
├── util.py                  # Helpers puros (ex: formatação de tempo).
├── core/
│   ├── processor.py         # Cérebro. Gerencia Fila e Fluxo de Trabalho (Orquestrador).
│   ├── token_engine.py      # Wrapper do Tiktoken com fallback para contagem por bytes.
│   ├── scanner.py           # (Dormant) Lógica para varredura de arquivos locais.
│   └── tree_logic.py        # (Dormant) Estrutura de dados para árvores de arquivos.
├── services/
│   └── youtube_manager.py   # Camada de integração externa. Isola yt-dlp/requests e limpeza de texto.
├── storage/
│   └── db_handler.py        # Camada de persistência. CRUD SQLite e migrações.
├── ui/
│   ├── app_window.py        # Janela Principal. Monta o layout (Splitters, Notebook).
│   ├── sidebar.py           # Navegação lateral (TreeCtrl).
│   ├── panel_batch.py       # Aba 1: Entrada de Dados e Status.
│   ├── panel_excel.py       # Aba 2: Grade de dados rica (wx.Grid).
│   ├── panel_detail.py      # Aba 3: Visualização de conteúdo e high-contrast.
│   └── panel_console.py     # Painel de Logs inferior.
└── data/                    # (Gerado em runtime)
    ├── contextflow.db       # Banco de dados SQLite.
    └── thumbs/              # Cache de imagens JPG.
```

---

## 4. Requisitos Funcionais (RFs)

### Módulo: Processamento (Batch)
*   **RF-001: Inserção em Lote**
    *   **Ação:** Usuário cola lista de URLs (vídeo ou playlist) na `BatchPanel`.
    *   **Lógica:** `Processor.add_urls()` parseia linha a linha e expande playlists usando `YouTubeManager.get_playlist_info()`.
*   **RF-002: Download de Metadados e Thumbnail**
    *   **Ação:** Processador pega tarefa da fila.
    *   **Lógica:** Extrai Título, Duração, Data e URL da Thumb. Baixa a imagem para `/data/thumbs/{id}.jpg`.
*   **RF-003: Transcrição e Limpeza**
    *   **Ação:** Processador solicita transcrição.
    *   **Lógica:** [YouTubeManager](file:///c:/Users/Usuario/Desktop/pro/contextflow/services/youtube_manager.py#16-215) tenta obter legenda oficial, depois auto-gerada (JSON3), e aplica Regex agressivo para remover timestamps (`00:00`), tags XML e lixo de metadados.

### Módulo: Gestão e Visualização (Excel/Detail)
*   **RF-004: Visualização em Grid (Excel Mode)**
    *   **Ação:** Usuário acessa Aba 2.
    *   **Lógica:** `ExcelPanel` carrega DB. Exibe colunas customizadas: Checkbox, Status Imagem, Link, Título, Playlist, Tempo (HH:MM:SS), Tokens.
*   **RF-005: Exclusão Física**
    *   **Ação:** Usuário deleta vídeo.
    *   **Lógica:** `DatabaseHandler.delete_video()` remove registro do SQLite **E** apaga o arquivo físico `.jpg` da pasta de thumbs.
*   **RF-006: Leitura em Alto Contraste**
    *   **Ação:** Usuário seleciona vídeo.
    *   **Lógica:** [DetailPanel](file:///c:/Users/Usuario/Desktop/pro/contextflow/ui/panel_detail.py#8-117) exibe texto em componente `wx.html2` (WebView) com CSS injetado para fundo escuro (`#1e1e1e`) e texto claro.

---

## 5. Requisitos Não Funcionais (RNFs)

*   **RNF-001: Responsividade da UI**: Operações de rede (download/parse) **devem** ocorrer em thread separada ([core/processor.py](file:///c:/Users/Usuario/Desktop/pro/contextflow/core/processor.py)), nunca bloqueando a MainLoop do wxPython.
*   **RNF-002: Resiliência a Falhas de Rede**: Se uma imagem ou vídeo falhar, o sistema não deve crashar. Deve registrar erro no Console e continuar o próximo item da fila.
*   **RNF-003: Persistência de Estado**: Dados processados devem sobreviver ao reinício do app (SQLite).
*   **RNF-004: Performance de Lista**: A Grid deve suportar centenas de linhas sem lag excessivo (uso de `wx.grid` vs controles nativos pesados).

---

## 6. Análise Técnica Profunda

### 6.1. Orquestração com [Processor](file:///c:/Users/Usuario/Desktop/pro/contextflow/core/processor.py#25-187) (Producer-Consumer)
*   **O que é:** Uma classe que roda um loop infinito em uma `threading.Thread` daemon.
*   **Por que:** Evita congelamento da janela "Não Respondendo" do Windows.
*   **Como funciona:** Usa `queue.Queue` para thread-safety. A UI (Main Thread) põe URLs na fila. O Worker (Bg Thread) consome, processa e dispara callbacks via `wx.CallAfter` (crucial para não violar thread-safety da GUI).

### 6.2. Estratégia de Transcrição Híbrida ([YouTubeManager](file:///c:/Users/Usuario/Desktop/pro/contextflow/services/youtube_manager.py#16-215))
*   **Estratégia:**
    1.  Tenta API oficial de legendas (mais limpa).
    2.  Fallback para `yt-dlp` baixando JSON3/VTT (legendas automáticas).
    3.  Limpeza Heurística: Usa Regex para arrancar artefatos como `<00:00:10>`, `[Música]`, e estruturas JSON residuais.

### 6.3. Banco de Dados SQLite ([DatabaseHandler](file:///c:/Users/Usuario/Desktop/pro/contextflow/storage/db_handler.py#9-213))
*   **Schema:** Duas tabelas principais.
    *   [videos](file:///c:/Users/Usuario/Desktop/pro/contextflow/storage/db_handler.py#135-145): Metadados leves (título, duração, status, caminhos).
    *   `transcripts`: Payload pesado (texto completo), separado para performance de leitura da lista.
*   **Migração:** Sistema de "Auto-Migrate" no [__init__](file:///c:/Users/Usuario/Desktop/pro/contextflow/ui/tab_view.py#7-10). Verifica se colunas novas (ex: `playlist_id`) existem via `PRMA table_info` e aplica `ALTER TABLE` se necessário.

---

## 7. Mapeamento Mestre de Componentes Críticos

| Arquivo/Classe | Método | Quem Chama? | O que faz? (Lógica de Negócio) |
| :--- | :--- | :--- | :--- |
| [processor.py](file:///c:/Users/Usuario/Desktop/pro/contextflow/core/processor.py) | [_worker_loop](file:///c:/Users/Usuario/Desktop/pro/contextflow/core/processor.py#76-85) | Thread Start | Loop infinito que monitora a `App.queue`. Consome item, chama [_process_task](file:///c:/Users/Usuario/Desktop/pro/contextflow/core/processor.py#86-145). |
| [processor.py](file:///c:/Users/Usuario/Desktop/pro/contextflow/core/processor.py) | [_process_task](file:///c:/Users/Usuario/Desktop/pro/contextflow/core/processor.py#86-145) | Worker Loop | 1. Baixa Meta. 2. Baixa Thumb. 3. Busca Transcrição. 4. Conta Tokens. 5. Salva DB. notifica UI. |
| [panel_batch.py](file:///c:/Users/Usuario/Desktop/pro/contextflow/ui/panel_batch.py) | [on_click_process](file:///c:/Users/Usuario/Desktop/pro/contextflow/ui/panel_grid.py#176-186) | Botão UI | Pega texto cru do Input, separa linhas, valida URL e enfia na Fila do Processor. |
| [db_handler.py](file:///c:/Users/Usuario/Desktop/pro/contextflow/storage/db_handler.py) | [delete_video](file:///c:/Users/Usuario/Desktop/pro/contextflow/storage/db_handler.py#157-183) | UI (Delete) | 1. Busca path da imagem. 2. `os.remove(path)`. 3. `DELETE FROM transcripts`. 4. `DELETE FROM videos`. |
| [youtube_manager.py](file:///c:/Users/Usuario/Desktop/pro/contextflow/services/youtube_manager.py) | [_clean_downloaded_subs](file:///c:/Users/Usuario/Desktop/pro/contextflow/debug_transcript.py#12-38) | Processor | Recebe "linguição" JSON3/XML do YouTube. Tenta parse JSON ou Regex Brutal para extrair apenas texto humano. |
| [app_window.py](file:///c:/Users/Usuario/Desktop/pro/contextflow/ui/app_window.py) | `on_process_complete` | Processor (Event) | Disparado ao fim de um vídeo. Força `refresh_data()` na Grid e na Sidebar. |

---

## 8. Guia MESTRE de Replicação (Do Zero)

Siga este roteiro para recriar o ambiente em qualquer máquina Windows/Linux/Mac.

### 1. Pré-requisitos
*   **Python 3.10+** instalado (Testado com 3.11).
*   **FFmpeg** (Opcional, mas recomendado para `yt-dlp` em alguns formatos, embora para subs/metadata puro não seja estritamente obrigatório, é boa prática ter no PATH).

### 2. Setup do Projeto
```bash
# 1. Crie a pasta
mkdir contextflow
cd contextflow

# 2. Crie o ambiente virtual
python -m venv venv

# 3. Ative (Windows)
./venv/Scripts/activate
# ou (Linux/Mac)
# source venv/bin/activate
```

### 3. Instalação de Dependências
Crie um arquivo `requirements.txt` com o seguinte conteúdo (baseado nas importações do código):
```text
wxPython>=4.2.0
yt-dlp>=2023.0.0
youtube-transcript-api
tiktoken
requests
```

Comando de instalação:
```bash
pip install -r requirements.txt
```
*(Nota: `sqlite3`, `json`, [os](file:///c:/Users/Usuario/Desktop/pro/contextflow/ui/app_window.py#110-114), `threading`, [re](file:///c:/Users/Usuario/Desktop/pro/contextflow/ui/sidebar.py#128-131) são built-in do Python)*

### 4. Estrutura de Arquivos
Crie manualmente (ou via script) a árvore de diretórios descrita na Seção 3. Copie os códigos fornecidos ([main.py](file:///c:/Users/Usuario/Desktop/pro/contextflow/main.py), `ui/*.py`, `core/*.py`, etc.) para seus respectivos lugares.

### 5. Execução
```bash
python main.py
```

### 6. Teste de Fumaça (Smoke Test)
1.  O app abriu maximizado?
2.  Vá na aba "Dados". Cole: `https://www.youtube.com/watch?v=jNQXAC9IVRw` (Primeiro vídeo do YouTube).
3.  Clique "Processar Fila".
4.  Observe a barra de status e o Painel de Console (Fundo Inferior).
5.  Quando finalizar, vá na aba "Excel". O vídeo deve estar lá.
6.  Vá na aba "Leitura". O texto deve aparecer em fundo escuro (High Contrast).

---

## 9. Integrações Externas

*   **YouTube (Unoficial):** O sistema não usa a API V3 do Google (quota limitada). Ele usa engenharia reversa do player web.
    *   **Risco:** O YouTube muda o layout e quebra o `yt-dlp`.
    *   **Mitigação:** Manter `yt-dlp` atualizado (`pip install -U yt-dlp`) é a primeira ação de suporte.

---

## 10. Limitações Conhecidas

1.  **Bloqueio de IP:** Se você processar 500 vídeos em 1 minuto, o YouTube vai bloquear seu IP temporariamente ("HTTP 429"). O código tem headers "realistas" (`User-Agent` rotativo em [youtube_manager.py](file:///c:/Users/Usuario/Desktop/pro/contextflow/services/youtube_manager.py)), mas não tem proxy rotation.
2.  **Thumbnails na Grid:** Por design (performance), a Grid mostra apenas o texto `[Imagem]` ou placeholder, para evitar carregar 100 bitmaps na thread principal de renderização. A imagem real aparece na aba "Leitura" ou Sidebar.
3.  **Consumo de Memória:** O `wx.html2.WebView` (Edge/Chrome embedded) consome RAM considerável (100MB+ por instância).

---

## 11. Roadmap Inferido

*   **V4.1 (Curto Prazo):** Implementar "Scanner Local" (ativar os módulos [scanner.py](file:///c:/Users/Usuario/Desktop/pro/contextflow/core/scanner.py) dormentes) para processar PDFs e TXTs locais.
*   **V4.5:** Implementar "Resumo Automático" (Integração com API OpenAI para gerar resumo do conteúdo extraído).
*   **V5.0:** Busca Semântica (Vector DB) sobre o conteúdo transcrito.
