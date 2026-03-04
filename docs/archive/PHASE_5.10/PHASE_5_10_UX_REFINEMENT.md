# PHASE 5.10 UX REFINEMENT: Roteiro de Polimento e Feedback Visual

> **Status:** SSoT (Fonte Única de Verdade)  
> **Foco:** Visibilidade de Processo, Redução de Fricção e Diagnóstico Ágil  
> **Alvos:** `ui/tab_batch.py`, `ui/panel_console.py`, `ui/app_window.py`

---

## 1. Indicador de Esforço: Loading Gauge

Atualmente, ao clicar em "PROCESSAR FILA", o usuário enfrenta um vácuo de feedback até que os itens comecem a brotar na grade. Para reduzir a ansiedade de carga, será implementada uma sinalização de progresso imediata na **Doca de Carga (Aba 1)**.

*   **Componente:** Inserção de um `wx.Gauge` (barra de progresso) logo abaixo do botão de processamento na `ui/tab_batch.py`.
*   **Lógica de Ativação:**
    *   O gauge inicia em modo "indeterminado" (pulsação) assim que o botão é clicado.
    *   Ao iniciar a resolução assíncrona de URLs no `Processor`, o sistema publica o total de linhas detectadas.
    *   O gauge torna-se "determinado", atualizando-se a cada URL validada ou vídeo de playlist enfileirado.
*   **Feedback de Término:** O gauge desaparece ou reseta após o processamento da lista de input, cedendo espaço para a telemetria da grade virtual.

---

## 2. Jornada Sem Fricção: Padrão Undo (Snackbar)

A exclusão massiva de vídeos atualmente é interrompida por diálogos modais (`wx.MessageDialog`) que exigem cliques extras e quebram o fluxo de triagem rápida.

*   **Substituição de Modal:** O aviso de confirmação "Tem certeza?" será desativado para exclusões de rotina.
*   **Implementação do Snackbar:**
    *   Ao clicar em "Excluir", os itens são removidos visualmente da grade e movidos para um buffer temporário de memória no `AppState`.
    *   Uma pequena barra horizontal (Snackbar) aparece na base da `AppWindow` com a mensagem: **"X vídeos movidos para a lixeira. [DESFAZER]"**.
    *   **Timer de Persistência:** Se o botão "Desfazer" não for clicado em 5 segundos, o `AppState` dispara a deleção física definitiva no SQLite.
*   **Impacto:** Permite que o analista limpe centenas de itens com fluidez, mantendo a segurança da reversibilidade.

---

## 3. Diagnóstico Visual: Logs Coloridos

O console de log atual é monocromático, dificultando a triagem de falhas técnicas entre o fluxo constante de informações de sistema.

*   **Coloração Sintática (Semantic Logging):**
    *   **INFO / SYSTEM:** Mensagens em **Azul (#3182CE)** para indicar progresso normal.
    *   **WARNING:** Mensagens em **Laranja (#DD6B20)** para alertas de Cooldown ou limites de token.
    *   **ERROR:** Mensagens em **Vermelho (#E53E3E)** para falhas de rede (429) ou erros de API.
*   **Implementação Técnica:**
    *   Refatoração do `WxLogHandler` em `ui/panel_console.py` para utilizar `wx.TextAttr`.
    *   Uso de `txt_log.SetDefaultStyle` antes de cada inserção, garantindo que o estilo não vaze para a próxima linha.
*   **Benefício:** Identificação instantânea de bloqueios do YouTube ou erros de crédito de IA sem leitura exaustiva do texto.

---

## 4. Estética de Triagem: Tags Dinâmicas (Color-Coding)

Para elevar a interface ao nível SaaS Premium, as pílulas de tags na Aba 2 deixarão de ser puramente cinzas.

*   **Algoritmo de Cor:** Implementação de uma função hash que gera uma cor de fundo (com 20% de opacidade) baseada no nome da tag (estilo GitHub/Notion).
*   **Renderização:** O `ChipTagRenderer` em `ui/virtual_table.py` aplicará essas cores dinamicamente, facilitando a triagem visual de temas (ex: tags de 'Finanças' sempre em tons verdes, 'Liderança' em azuis).

---

## 5. Matriz de Implementação UX

| Recurso | Arquivo | Componente wx | Evento/Trigger |
| :--- | :--- | :--- | :--- |
| **Loading Gauge** | `tab_batch.py` | `wx.Gauge` | `on_click_process` |
| **Undo Bar** | `app_window.py` | `wx.InfoBar` | `VIDEOS_DELETED` (PubSub) |
| **Logs Coloridos** | `panel_console.py` | `RichTextCtrl` | `WxLogHandler.emit` |
| **Tags Pro** | `virtual_table.py` | `ChipTagRenderer` | `OnPaint` |

---
**Critério de Homologação:** O usuário deve ser capaz de excluir um vídeo por engano e recuperá-lo via Snackbar, além de identificar visualmente um erro de rede no console através da cor vermelha, sem precisar ler a mensagem técnica.
