# PRD: ContextFlow - Transformador de Conteúdo de Vídeo para Análise Inteligente

> **Versão:** 1.0  
> **Data:** 25 de janeiro de 2026  
> **Status:** Documentação Viva e Evolutiva  
> **Proprietário:** Equipe de Desenvolvimento ContextFlow

## 1. Visão Geral do Produto

### Identidade do Produto
- **Nome Oficial:** ContextFlow  
- **Versão Atual:** 1.0 (Pré-lançamento)  
- **Slogan:** "Transforme vídeos do YouTube em insights acionáveis em segundos."  
- **Missão:** Simplificar a extração, limpeza e análise de conteúdo de vídeo para analistas que precisam sintetizar grandes volumes de informações rapidamente.

### Personas Principais (Foco Estratégico no Analista)
| Persona | Nome | Dor Principal | Trabalho a ser Feito |
|---------|------|---------------|----------------------|
| **O Analista** | Ana | Precisa analisar centenas de vídeos para extrair insights sem perder tempo assistindo cada um | "Transformar horas de conteúdo em transcrições estruturadas que permitam identificação rápida de padrões" |
| **O Arquivista** | Marcos | Precisa coletar e armazenar grandes volumes de conteúdo com confiabilidade | "Criar uma base de dados offline de conteúdo para consulta futura" |

**Diferenciais Estratégicos:**
- **Foco no Analista:** Prioriza interface robusta para navegação massiva.
- **Performance Extrema:** Virtualização de Grid permite navegação fluida com +10.000 vídeos.
- **Experiência de Usuário Profissional:** Interface estilo planilha com drag-and-drop, ordenação e expansão de células.

**Decisão Estratégica:** O ContextFlow focará PRIMARIAMENTE no perfil **Analista**, entregando uma experiência de triagem e análise rápida.

## 2. Arquitetura de Alto Nível e Escolhas Tecnológicas

### Fluxo de Dados Principal
```mermaid
graph TD
    A[Usuário] -->|Insere URLs| B[Interface Principal]
    B -->|Enfileira| C[Processor Service]
    subgraph Core System
        C -->|Baixa Metadados| D[YouTube Manager]
        D -->|yt-dlp/API| E[YouTube]
        C -->|Persiste Dados| H[AppState]
        H -->|Notifica UI| I[PubSub]
        H -->|Salva| J[SQLite DB]
    end
    I -->|Atualiza| K[Grid Virtualizada]
    I -->|Atualiza| L[Painel de Detalhes]
```

### Stack Tecnológico
| Tecnologia | Versão | Por que foi Escolhida | Alternativas Consideradas |
|------------|--------|------------------------|----------------------------|
| **Python** | 3.11+ | Ecossistema maduro para processamento de dados e automação | Node.js (menos estável para processamento pesado) |
| **wxPython** | 4.2.0 | Componentes nativos do OS, performance superior para grids complexas | Electron (consumo alto de RAM), PyQt (curva de aprendizado mais íngreme) |
| **SQLite3** | 3.37+ | Zero configuração, arquivo único, perfeito para apps desktop single-user | PostgreSQL (complexidade desnecessária para este caso) |
| **yt-dlp** | 2023+ | Mais robusto e atualizado para engenharia reversa do YouTube | youtube-dl (descontinuado) |
| **PubSub** | wx.lib.pubsub | Desacoplamento completo entre UI e lógica de negócios | Callbacks diretos (acoplamento excessivo) |

### Padrões de Arquitetura
- **Single Source of Truth:** AppState como único local de estado da aplicação
- **Observer Pattern:** PubSub para notificações entre componentes
- **Virtualization:** Renderização sob demanda para Grid
- **Repository Pattern:** Isolamento de persistência através do DatabaseHandler

## 3. Árvore de Diretórios e Esqueleto do Projeto

```
contextflow/
├── docs/                     # Documentação viva e evolutiva
│   ├── ARCHITECTURE.md       # Explicação da arquitetura atual
│   ├── STRATEGY.md           # Decisão estratégica (foco no analista)
│   ├── DECISIONS/            # ADRs (Architectural Decision Records)
│   │   └── YYYY-MM-DD-descricao.md  # Registros de decisões importantes
│   └── USER_STORIES/         # Histórias de usuário priorizadas
├── core/                     # Lógica de negócios e processamento
│   ├── app_state.py          # AppState - fonte única da verdade
│   ├── processor.py          # Orquestração de tarefas
│   ├── token_engine.py       # Contagem de tokens para IA
│   └── export_formatter.py   # Formatação de exportações
├── services/                 # Integrações externas
│   └── youtube_manager.py    # Comunicação com YouTube
├── storage/                  # Persistência de dados
│   └── db_handler.py         # Camada de acesso ao banco
├── ui/                       # Interface do usuário (Topologia de 3 Abas)
│   ├── app_window.py         # Janela principal
│   ├── sidebar.py            # Navegação lateral
│   ├── tab_batch.py          # Aba 1: Doca de Carga (Ingestão)
│   ├── tab_analysis.py       # Aba 2: Cockpit Analítico (Master-Detail)
│   ├── panel_detail.py       # Aba 3: Leitura Imersiva (Painel de Detalhes)
│   └── styles.py             # Gerenciamento de temas
├── data/                     # Dados gerados em runtime
│   ├── contextflow.db        # Banco de dados principal
│   └── thumbs/               # Cache de thumbnails
├── tests/                    # Testes automatizados
├── KANBAN.md                 # Status atual do desenvolvimento
├── ROADMAP.md                # Visão de longo prazo
├── CHANGELOG.md              # Registro de mudanças por versão
└── main.py                   # Ponto de entrada da aplicação
```

## 4. Requisitos Funcionais (RFs)

### RF-001: Inserção e Processamento de URLs
- **Ação do Usuário:** Usuário cola URLs de vídeos ou playlists na área de input
- **Fluxo de Código:** 
  1. UI captura texto na `BatchPanel`
  2. `Processor.add_urls()` valida URLs e expande playlists
  3. Tarefas são enfileiradas com UUID temporário
  4. `AppState` notifica UI via PubSub para atualizar visualmente
- **Módulo Crítico:** `core/processor.py` (linhas 45-120)
- **Status:** Implementado (V2.3)

### RF-002: Interface Master-Detail
- **Ação do Usuário:** 
  1. Seleciona vídeo na Grid para ver detalhes (Master-Detail).
- **Fluxo de Código:**
  1. Evento `EVT_GRID_SELECT_CELL` dispara a exibição do Painel de Detalhes.
  2. `AppState` notifica componentes via PubSub.
- **Módulo Crítico:** `ui/tab_analysis.py`
- **Status:** Em implementação (Fase 5.7)

### RF-003: Exportação de Dados
- **Ação do Usuário:** Seleciona vídeos e escolhe formato de exportação
- **Fluxo de Código:**
  1. UI captura seleção e formato desejado
  2. `ExportManager` processa os dados
- **Módulo Crítico:** `core/export_manager.py`
- **Status:** Implementado

## 5. Requisitos Não Funcionais (RNFs)

### Performance
| Métrica | Alvo | Medição |
|---------|------|---------|
| **Tempo de Carregamento** | < 2s para 1.000 vídeos | Inicialização da aplicação |
| **Navegação na Grid** | < 100ms de latência | Movimento do mouse/teclado |
| **Uso de RAM (Idle)** | < 200MB | Em repouso |
| **Uso de RAM (Carga)** | < 250MB com 10.000 vídeos | Em processamento massivo |
| **Resposta a Eventos** | < 50ms | Clique em botões/filtros |

### Segurança
- **Rate Limiting:** Jitter aleatório entre requisições (2-5s) para evitar bloqueios
- **Tratamento de Erros:** Nenhum crash em falhas de rede ou YouTube
- **Proteção de Dados:** Banco de dados SQLite encriptado em versões futuras
- **Sanitização:** Todos os dados de entrada validados e limpos antes do processamento

### Usabilidade
- **Acessibilidade:** Suporte a leitores de tela e navegação por teclado
- **Internacionalização:** Suporte a múltiplos idiomas (inglês/português inicialmente)
- **Ergonomia Visual:** Contraste adequado para leitura prolongada
- **Feedback Imediato:** Progresso visual para todas as operações assíncronas

### Compatibilidade
- **Sistemas Operacionais:** Windows 10+, macOS 12+, Linux (Ubuntu 20.04+)
- **Python:** Versão 3.11 ou superior
- **Resolução:** Suporte a telas 1080p e superiores com layout responsivo

## 6. Análise Técnica Profunda

### 6.1. AppState: O Cérebro do Sistema
**O que é:** Singleton que gerencia o estado central da aplicação em memória.  
**Por que escolhemos:** Resolveu o problema crítico de concorrência onde deletar playlists fazia tarefas em andamento desaparecerem.  
**Como funciona:**
```python
class AppState:
    _instance = None
    _lock = threading.RLock()  # Para thread safety
    
    def __init__(self):
        self._videos = {}  # ID -> dados completos
        self._active_tasks = {}  # UUID -> dados temporários
        self._observers = []  # Para notificações via PubSub
```
**Riscos Mitigados:**  
- Race conditions com `threading.RLock()`
- Perda de dados com persistência assíncrona
- UI travando com notificações via `wx.CallAfter`

### 6.2. Virtualização da Grid
**O que é:** Técnica de renderização que carrega apenas dados visíveis na tela.  
**Por que escolhemos:** Grid tradicional travava com >100 vídeos.  
**Como funciona:**
```python
class VirtualTable(wx.grid.PyGridTableBase):
    def GetValue(self, row, col):
        # Só carrega dados quando realmente necessários para renderização
        video_id = self.row_data[row]
        return self.app_state.get_video_field(video_id, col)
```
**Benefícios:**  
- Performance constante independentemente do volume de dados
- Memória otimizada com carregamento sob demanda
- Experiência de usuário fluida mesmo com 10.000+ vídeos

## 11. Infraestreutura

### Requisitos Mínimos
| Componente | Especificação |
|------------|---------------|
| **Processador** | Dual-core 2.0GHz+ |
| **Memória RAM** | 4GB (8GB recomendados para >10.000 vídeos) |
| **Armazenamento** | 100MB para instalação + espaço para dados |
| **Sistema Operacional** | Windows 10+, macOS 12+, Linux (Ubuntu 20.04+) |
| **Conexão Internet** | 10Mbps para downloads rápidos |

### Variáveis de Ambiente (`.env`)
```env
# Obrigatórias para funcionalidade básica
DATA_DIR=./data
DB_PATH=./data/contextflow.db

# Opcionais
DATA_DIR=./data
DB_PATH=./data/contextflow.db

# Avançadas
MAX_CONCURRENT_DOWNLOADS=3
YOUTUBE_COOKIES_PATH=/path/to/chrome/cookies
```

## 12. Extensibilidade e Customização

### Arquitetura de Plugins
O sistema suporta plugins para:
- Novos provedores de IA
- Formatos de exportação personalizados
- Filtros de transcrição especializados

### Como Criar um Plugin de IA (Exemplo)
1. Crie arquivo `services/ia_providers/custom_provider.py`
2. Implemente interface base:
```python
from services.ia_providers.base_provider import BaseProvider

class CustomProvider(BaseProvider):
    def generate_summary(self, transcript: str) -> str:
        """Implementação personalizada do resumo"""
        # Sua lógica aqui
        return summary
```
3. Registre o provedor em `services/ia_providers/__init__.py`
4. Configure no arquivo `config.json`

## 13. Limitações Conhecidas

### Limitações Técnicas
1. **Bloqueio do YouTube:** Se processar mais de 50 vídeos em 10 minutos, pode sofrer bloqueio temporário
2. **Transcrições em Outros Idiomas:** Qualidade do resumo depende da qualidade da transcrição original
3. **Performance em Máquinas Antigas:** Interface pode ficar lenta com <4GB de RAM e milhares de vídeos
4. **Vídeos com Restrição de Idade:** Alguns vídeos podem precisar de autenticação para acessar transcrições

### Workarounds Sugeridos
- **Para Bloqueio:** Use cookies do navegador e limite a 20 vídeos por sessão
- **Para Restrição de Idade:** Configure cookies autenticados do Chrome
- **Para Performance:** Aumente memória do sistema ou reduza número de vídeos carregados simultaneamente

## 14. Roadmap de Consolidação
Veja o arquivo [BACKLOG_FUTURO.md](file:///c:/Users/Usuario/Desktop/contextflow/docs/BACKLOG_FUTURO.md) para funcionalidades planejadas.

## 15. Guia MESTRE de Replicação (Do Zero)

### Passo 1: Pré-requisitos
```bash
# Python (versão exata)
python --version  # Deve ser 3.11 ou superior

# Bibliotecas do sistema
# Windows: Nenhuma adicional
# macOS: xcode-select --install
# Linux (Ubuntu): sudo apt-get install python3-dev ffmpeg libgl1
```

### Passo 2: Configuração do Ambiente
```bash
# 1. Clone o repositório
git clone https://github.com/seuusuario/contextflow.git 
cd contextflow

# 2. Crie ambiente virtual
python -m venv venv

# 3. Ative o ambiente (Windows)
venv\Scripts\activate
# ou (Linux/Mac)
# source venv/bin/activate

# 4. Instale dependências
pip install -r requirements.txt
```

### Passo 3: Arquivo de Requisitos (`requirements.txt`)
```
wxPython>=4.2.0
yt-dlp>=2023.03.04
youtube-transcript-api>=0.6.0
tiktoken>=0.5.1
requests>=2.28.0
Pillow>=9.4.0
python-dotenv>=1.0.0
```

### Passo 4: Configuração Inicial
```bash
# 1. Crie pasta de dados
mkdir -p data/thumbs

# 2. Configure variáveis de ambiente (opcional para IA)
echo "OPENAI_API_KEY=sua_chave_aqui" > .env

# 3. Execute a aplicação
python main.py
```

### Passo 5: Teste de Fumaça
1. **Abertura:** Aplicação abre maximizada com Dark Theme
2. **Funcionalidade Básica:** 
   - Vá para aba "Dados"
   - Cole URL de teste: `https://www.youtube.com/watch?v=dQw4w9WgXcQ `
   - Clique em "Processar Fila"
3. **Visualização:** 
   - Após processamento, vídeo aparece na Grid
   - Clique no vídeo para ver transcrição na aba "Conteúdo"
4. **Exportação:**
   - Selecione o vídeo na Grid
   - Clique em "Exportar Selecionados (ZIP)"
   - Verifique arquivo exportado

### Passo 6: Ambiente de Desenvolvimento
```bash
# Estrutura recomendada para contribuir
contextflow/
├── .vscode/                 # Configurações do VSCode
│   ├── settings.json        # Formatação automática
│   └── launch.json          # Debug configurations
├── dev-requirements.txt     # Dependências de desenvolvimento
└── scripts/                 # Scripts utilitários
    ├── migrate_db.py        # Migrações de banco
    └── generate_docs.py     # Atualização automática de docs
```

### Passo 7: Contribuindo com o Projeto
1. **Padrão de Commits:** Use Conventional Commits
   - `feat:` para novas funcionalidades
   - `fix:` para correções de bugs
   - `docs:` para atualizações de documentação
   - `refactor:` para mudanças de código sem alterar comportamento

2. **Pull Requests:** Todo PR deve:
   - Atualizar documentação relevante
   - Incluir testes para nova funcionalidade
   - Seguir convenções de código existentes

3. **Versionamento:** 
   - Versões semver após v1.0
   - Branches por feature: `feature/nome-da-feature`
   - Branch principal: `main`

---

Este PRD é um **documento vivo** que evolui com o projeto. Ele substitui arquivos de configuração complexos e comentários espalhados pelo código, centralizando todo o conhecimento necessário para entender, manter e evoluir o ContextFlow.

**Próximos passos recomendados:**
1. Implementar Fase 5.5 conforme o plano detalhado
2. Atualizar este documento conforme novas descobertas e decisões
3. Criar um sistema de alertas para quando este documento divergir do código

*Este documento foi gerado pensando em ser 100% replicável por qualquer desenvolvedor, mesmo sem conhecimento prévio do projeto. Ele representa a visão consolidada de como o ContextFlow DEVE SER, não apenas como está atualmente.*