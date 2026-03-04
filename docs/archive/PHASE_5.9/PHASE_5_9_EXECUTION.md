# PHASE 5.9 EXECUTION: Roteiro de Implementação do Cockpit Analítico

> **Status:** SSoT (Fonte Única de Verdade)  
> **Alvo:** `ui/tab_analysis.py`  
> **Dependências:** `core/app_state.py`, `core/pubsub.py`, `ui/virtual_table.py`  
> **Objetivo:** Restauração da Interface Moderna (Master-Detail) com suporte a 10.000+ vídeos.

---

## 1. Protocolo de Inicialização e Blindagem

Para respeitar o **Protocolo Zero-Knowledge**, a implementação deve garantir o isolamento total de contexto entre as abas.

*   **Ação:** Criar/Refatorar `ui/tab_analysis.py`.
*   **Importações Proibidas:** É terminantemente proibido importar qualquer componente de `ui/tab_batch.py`.
*   **Importações Mandatárias:** `AppState` (Singleton), `PubSub`, `wx.SplitterWindow`, e a classe de virtualização rica configurada para a Aba 2.

---

## 2. Estruturação do Layout Master-Detail

A Aba 2 deve abandonar a rigidez estática da Aba 1 e adotar a topologia dinâmica necessária para a triagem.

### Passo 1: O Splitter Window
1.  Instancie um `wx.SplitterWindow` com orientação horizontal.
2.  **Estado Inicial:** Configure o splitter para iniciar em modo **Unsplit**, mantendo o painel inferior oculto até que um evento de seleção ocorra.

### Passo 2: O Painel Master (Topo)
1.  Crie um painel contendo a **Toolbar Analítica** (SearchCtrl, botões de Resumo e Exportação) [Specs 5.9].
2.  Instancie a `VirtualVideoTable` dedicada à Aba 2, configurada com as **11 colunas analíticas** (incluindo Preview e Tags) [Specs 5.9, 1253].
3.  Vincule o `SearchCtrl` ao método de filtragem do `AppState`, garantindo resposta < 50ms [Specs 5.9, 436].

### Passo 3: O Painel Detail (Base)
1.  Crie o `SummaryPanel` como o segundo filho do Splitter.
2.  Implemente o método `Clear()` para limpar o painel quando a seleção na grade for perdida.
3.  Garanta a aplicação do **Dark Theme CSS (#1E1E1E)** para evitar problemas de contraste observados em versões anteriores.

---

## 3. Lógica Reativa e "Smart Show"

A interface deve reagir de forma inteligente ao estado dos dados sem intervenção manual constante.

1.  **Monitoramento de Seleção:** Vincule o evento de clique/seleção da grade ao motor reativo.
2.  **Lógica Smart Show:** Ao selecionar um vídeo:
    *   Consulte se `has_summary` é verdadeiro no `AppState`.
    *   Se positivo, execute `SplitHorizontally` para exibir o resumo.
3.  **Debouncing "Restart-on-Event":** 
    *   Implemente um `wx.Timer` de **250ms** para refreshes da grade.
    *   Qualquer sinal de `VIDEO_UPDATED` vindo do `PubSub` deve reiniciar o timer, garantindo que a renderização rica não compita com a ingestão massiva da Aba 1.

---

## 4. Renderização Rica e Performance

O motor virtual deve suportar mídia pesada mantendo a fluidez industrial.

1.  **LRU Cache de Thumbnails:** Integre o carregamento assíncrono de imagens no `OnPaint` da tabela, limitando a RAM a 50 Bitmaps ativos [Rich Rendering 5.9, 1250].
2.  **Custom Renderers:** Utilize `wx.GraphicsContext` para desenhar:
    *   As **Pílulas de Tags** (Chips coloridos) na coluna 5 [Specs 5.9, 1259].
    *   O bloco de **RichText** (Título Negrito + Canal Itálico) na coluna 3 [Rich Rendering 5.9, 1253].
3.  **Atomic Snapshot:** O refresh deve sempre ler um snapshot total e atômico do `AppState` para evitar o efeito de "pulo" de linhas durante a promoção de vídeos.

---

## 5. Validação de DoD (Definition of Done)

A tarefa só será considerada concluída se atender aos critérios:

- [ ] Splitter inicia oculto e expande apenas via lógica **Smart Show**.
- [ ] Scroll na Aba 2 mantém **60 FPS** com miniaturas ativas.
- [ ] Uso de RAM global permanece **< 250MB** em carga.
- [ ] Nenhuma importação circular detectada com `ui/tab_batch.py`.
- [ ] Todas as atualizações de UI utilizam obrigatoriamente **`wx.CallAfter`**.
