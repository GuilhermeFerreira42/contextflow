# SPEC F5-UI — Reformulação da Interface (UI/UX)

> Status: Em desenvolvimento. Baseado nos mockups fornecidos em `code (2).html` e `code (3).html`.

## 1. Objetivo

Reformular a interface do ContextFlow para alinhar com os mockups fornecidos, transformando a interface em uma experiência centrada na Biblioteca de vídeos, com:
- Biblioteca como área central de trabalho (tabela com linhas ampliadas, leitura inline)
- Sidebar estilo VS Code Explorer (hierárquica, expansível, recolhível)
- Painel sobreposto de leitura (estilo Trello)
- Barra superior com ações globais (Adicionar link, filtros, busca)
- Identidade visual: tema escuro, hierarquia visual clara, espaçamento consistente

## 2. Escopo

### Entra no escopo
- Reformulação completa do `index.html` (estrutura, semântica, acessibilidade)
- Reformulação completa do `principal.css` (tema, layout, componentes, responsividade)
- Reformulação do `aplicacao.js` (novos componentes: Biblioteca virtualizada, Sidebar Explorer, Painel de leitura, Modal Adicionar link, Modal Filtros)
- Nova biblioteca JS `biblioteca.js` para lógica da Biblioteca (virtualização, seleção, filtros, ordenação, ações em lote)
- Novos endpoints HTTP para suportar a nova UI (filtros avançados, ordenação, ações em lote, coleções, painel de leitura)
- Testes E2E atualizados para validar a nova UI

### Não entra no escopo
- Funcionalidades de backend não relacionadas à UI (F6, IA, etc.)
- Drag-and-drop entre grupos/coleções (futuro)
- Autenticação/usuários (fora do escopo V1)
- Mudanças no backend de persistência além do necessário para suportar a UI

## 3. Arquitetura da Interface

### Layout Geral (Grid)
```
┌─────────────────────────────────────────────────────────────┐
│ TopBar (56px)                                               │
├──────────────┬──────────────────────────────────────────────┤
│ Sidebar      │ Main Content                                  │
│ (256px)      │ (flex-1)                                      │
│              │  ┌─────────────────────────────────────────┐ │
│  - Brand     │ │ TopBar: Title, Search, Actions, Add Link  │ │
│  - Nav       │ ├─────────────────────────────────────────┤ │
│  - Organize  │ │ Toolbar: Filters, Sort, View, Bulk Actions│ │
│  - Footer    │ ├─────────────────────────────────────────┤ │
│              │ │ Virtualized Table / Library View          │ │
│              │ │  - Virtualized rows (IntersectionObserver)│ │
│              │ │  - Row expansion for summary/transcript   │ │
│              │ │  - Selection (checkbox, shift-click)      │ │
│              │ │  - Bulk actions toolbar (floating)        │ │
│              │ └─────────────────────────────────────────┘ │
├──────────────┴─────────────────────────────────────────────┤
│ Reading Panel Overlay (portal, portal)                      │
└─────────────────────────────────────────────────────────────┘
```

### Breakpoints
- Desktop (≥1024px): Sidebar fixa 256px, content flex-1
- Tablet (768-1023px): Sidebar colapsível (off-canvas), hamburger menu
- Mobile (<768px): Sidebar off-canvas, bottom sheet para modais

## 4. Componentes Principais

### 4.1 TopBar (Header Global)
- **Altura**: 56px (h-14)
- **Background**: `#0d111a` (code 2) / `#111622` (code 3) - usar `#0d111a`
- **Elementos**:
  - Esquerda: Logo + Toggle Sidebar (hamburger)
  - Centro: Título da tela atual
  - Direita: Theme toggle, Help, User avatar, Notifications

### 4.2 Sidebar (Explorer Style)
- **Largura**: 256px (w-64) fixa, recolhível para 56px (icons only)
- **Background**: `#0c1017` / `#111622` → usar `#0c1017`
- **Seções**:
  1. **Navegação Principal** (tabs): Biblioteca, Importações, Configurações
  2. **Organizar por** (accordions):
     - Canais (expandível, com contador)
     - Playlists
     - Data de importação
     - Minhas coleções
  3. **Footer**: Versão, status

### 4.3 Biblioteca (Main Content)
#### Toolbar Superior
- Título + contador
- Busca (com atalho `/`)
- Botão Filtros (dropdown)
- Botão + Adicionar link (split button: primário + dropdown)

#### Tabela Virtualizada
- **Colunas**: Seleção, Vídeo (thumb + título), Canal, Duração, Transcrição, Resumo, Ações
- **Virtualização**: IntersectionObserver + sentinela, reciclagem de DOM
- **Linhas**: Altura fixa 48px, hover highlight, seleção visual
- **Expansão inline**: Clique na linha expande resumo/transcrição inline
- **Seleção**: Checkbox por linha, shift+click range, "Selecionar tudo visível"
- **Ações em lote**: Barra flutuante aparece quando há seleção (Reimportar, Remover, Mover para coleção)

#### Painel de Leitura (Overlay)
- Portal renderizado no body (fixed, z-50)
- Backdrop com blur
- Conteúdo: Título, meta, transcrição completa com timestamps clicáveis, resumo
- Fechar: ESC, backdrop click, botão fechar

### 4.4 Modal Adicionar Link
- Split button: "Adicionar link" (primário) + dropdown (playlist, lote)
- Modal centralizado com backdrop blur
- Campos: URL, destino (coleção/playlist), opções IA (transcrição, resumo)
- Validação URL, paste from clipboard
- Feedback visual: loading, toast notifications

### 4.5 Tela Importações
- Lista de trabalhos (tabela ou cards)
- Filtros, busca, paginação
- Ações: Cancelar, Repetir, Ver detalhes
- Progresso visual, logs, retry

### 4.6 Configurações
- Provedor IA, modelo, prompt, API key
- Pasta de dados, tema, preferências
- Status dos módulos

## 5. Contratos de Dados (Shared Types)

```typescript
// Video (expandido)
interface Video {
  id: string;
  youtubeId: string;
  titulo: string;
  canalId: string | null;
  canalNome: string | null;
  duracaoSegundos: number | null;
  url: string;
  miniaturaUrl: string | null;
  publicadoEm: string | null;
  estado: 'novo' | 'importando' | 'pronto' | 'parcial' | 'erro';
  colecaoIds: string[];        // F5: IDs das coleções
  temResumo: boolean;          // denormalizado para UI
  criadoEm: string;
  atualizadoEm: string;
}

// Colecao
interface Colecao {
  id: string;
  titulo: string;
  contagem: number;
}

// Trabalho (Fila)
interface Trabalho {
  id: string;
  tipo: 'importar-video' | 'importar-playlist' | 'importar-lote' | 'gerar-resumo';
  estado: 'na-fila' | 'executando' | 'concluido' | 'falhou' | 'cancelado';
  progresso: number | null;
  tentativas: number;
  erro: string | null;
  criadoEm: string;
  atualizadoEm: string;
}
```

## 6. Endpoints HTTP Novos / Alterados

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/biblioteca` | Lista paginada com filtros, ordenação, cursor |
| GET | `/api/biblioteca/:id` | Detalhe do vídeo + transcrição + resumo |
| GET | `/api/biblioteca/:id/transcricao` | Transcrição completa (para painel) |
| POST | `/api/biblioteca/lote` | Ações em lote (reimportar, remover, mover) |
| GET | `/api/biblioteca/canais` | Lista canais para filtro |
| GET | `/api/biblioteca/playlists` | Lista playlists para filtro |
| GET | `/api/colecoes` | Lista coleções |
| POST | `/api/colecoes` | Criar coleção |
| POST | `/api/colecoes/:id/videos` | Adicionar vídeos à coleção |
| DELETE | `/api/colecoes/:id/videos/:videoId` | Remover vídeo da coleção |
| GET | `/api/biblioteca/playlists` | Playlists para filtro |
| POST | `/api/ingestao/lote` | Importar múltiplos vídeos |
| GET | `/api/trabalhos` | Lista trabalhos (fila) |
| POST | `/api/trabalhos` | Criar trabalho |
| POST | `/api/trabalhos/:id/cancelar` | Cancelar trabalho |
| POST | `/api/trabalhos/:id/repetir` | Repetir trabalho |

## 5. Critérios de Aceite

| # | Cenário | Critério |
|---|---------|----------|
| 1 | Layout carrega | Sidebar 256px, content flex-1, TopBar 56px |
| 2 | Sidebar recolhe | Clique no hamburger recolhe para 56px, ícones apenas |
| 3 | Navegação tabs | Biblioteca/Importações/Configurações funcionam |
| 4 | Sidebar accordions | Canais/Playlists/Data/Coleções expandem/recolhem |
| 5 | Biblioteca carrega | Tabela renderiza, virtualização ativa (sentinela) |
| 6 | Linhas têm altura fixa | 48px, thumbnails 64x36 |
| 6 | Expansão inline | Clique na linha expande resumo/transcrição |
| 7 | Seleção | Checkbox, shift+click range, "Selecionar tudo visível" |
| 8 | Ações em lote | Barra flutuante aparece, ações funcionam |
| 9 | Painel leitura | Abre overlay, transcrição completa, timestamps clicáveis |
| 10 | Modal Adicionar link | Abre, valida URL, paste clipboard, opções IA |
| 11 | Filtros | Busca, estado, canal, coleção, tem resumo funcionam |
| 12 | Ordenação | Clique no header ordena ASC/DESC, ícone visual |
| 12 | Sidebar collapse | Toggle recolhe para 56px, ícones apenas |
| 13 | Modal Adicionar link | Valida URL, paste clipboard, opções IA, toast |
| 14 | Tela Importações | Lista trabalhos, progresso, cancelar, repetir |
| 13 | Configurações | Provedor, modelo, prompt, chave, pasta dados |
| 14 | Responsivo | <1024px sidebar off-canvas, hamburger |
| 15 | Acessibilidade | ARIA, foco, teclado, contraste |

## 6. Riscos e Decisões Pendentes

| Risco | Mitigação |
|-------|-----------|
| Performance com 10k+ linhas | Virtualização com IntersectionObserver, reciclagem DOM |
| Acessibilidade painel leitura | ARIA roles, focus trap, ESC para fechar |
| Conflito CSS antigo/novo | Migração completa CSS, remover classes antigas |
| Compatibilidade IE | Não suportado (requisito: navegadores modernos) |
| Estado URL/history | history.replaceState para tabs, scroll restoration |

## 7. Definição de Concluído

- [ ] Todos os critérios de aceite passam (testes manuais + E2E)
- [ ] Testes unitários/integração passam (151+ pass, 6 skipped)
- [ ] E2E passa (26/26 cenários)
- [ ] Build + typecheck + lint passam
- [ ] Docs atualizadas (`estado-atual.md`, `handoff-codex.md`)
- [ ] Commit próprio com mensagem descritiva
- [ ] PR/merge pronto para homologação

---

**Precedência**: `01-escopo-canonico.md` > `03-arquitetura-e-contratos.md` > esta SPEC > `04-plano-mestre.md`