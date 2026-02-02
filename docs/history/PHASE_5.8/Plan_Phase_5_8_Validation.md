# PLANO DE VALIDAÇÃO: PHASE 5.8 (Restauração da Doca de Carga)

> **Objetivo:** Validar a fidelidade visual do padrão HeidiSQL e a estabilidade da Aba 1.
> **Alvo:** `ui/tab_batch.py` e `ui/virtual_table.py`.
> **Critério Global:** Conformidade total com o mockup `Queroassim.txt`.

## 1. Testes de Integridade Visual (Aba 1)

O objetivo é garantir que a interface retornou ao estado técnico de alta densidade sem vazamentos de componentes modernos.

| Caso de Teste | Procedimento | Resultado Esperado |
| :--- | :--- | :--- |
| **V01: Layout Estático** | Tentar redimensionar ou encontrar divisores móveis na Aba 1. | **Passou:** Nenhuma `wx.SplitterWindow` encontrada; layout 100% fixo. |
| **V02: Conferência de Colunas** | Contar e identificar as colunas na Grid Principal. | **Passou:** Exatamente 11 colunas presentes: #, [x], Thumb, Título, Canal, Publicado, Adicionado, Playlist, Duração, Tokens, Status. |
| **V03: Rodapé Operacional** | Verificar a presença dos botões na base da tela. | **Passou:** Botões "Excluir", "Unificar (.md)", "Baixar como MD" e "Exportar (ZIP)" visíveis e alinhados. |
| **V04: Visibilidade de Log** | Iniciar o app e observar a base da Aba 1. | **Passou:** O `System Log` está permanentemente visível abaixo da Grid. |

## 2. Testes de Fluxo Operacional (Fase 5.6 Style)

| Caso de Teste | Procedimento | Resultado Esperado |
| :--- | :--- | :--- |
| **O01: Ingestão Massiva** | Colar 50 URLs e clicar em "Processar Fila". | **Passou:** URLs movidas para a Grid e processamento iniciado via PubSub. |
| **O02: Seleção e Exclusão** | Marcar 5 itens na coluna [x] e clicar em "Excluir". | **Passou:** Itens removidos do banco e da visualização instantaneamente. |
| **O03: Unificação MD** | Selecionar 3 vídeos e clicar em "Unificar (.md)". | **Passou:** Gerado um único arquivo Markdown com as 3 transcrições. |
| **O04: Feedback de Erro** | Forçar um erro de rede (429). | **Passou:** A coluna "Status" da linha afetada deve ficar VERMELHA. |

## 3. Testes de Performance e Estabilidade (10k)

| Caso de Teste | Procedimento | Resultado Esperado |
| :--- | :--- | :--- |
| **P01: Latência de Scroll** | Rolar a lista com 10.000 itens carregados no AppState. | **Passou:** Scroll fluido (60 FPS) sem "piscadas" na UI. |
| **P02: Debouncing UI** | Iniciar carga massiva e monitorar Aba 1. | **Passou:** A Grid só atualiza após 250ms de silêncio no processamento. |
| **P03: Consumo de RAM** | Monitorar processo durante carga de 10.000 vídeos. | **Passou:** RAM mantida abaixo de 250MB (Alvo de Estabilidade). |

## 4. Testes de Segregação (Isolamento 5.7)

| Caso de Teste | Procedimento | Resultado Esperado |
| :--- | :--- | :--- |
| **S01: No-Leak Test** | Redimensionar o splitter da Aba 2 (Cockpit). | **Passou:** O layout da Aba 1 permanece inalterado e estático. |
| **S02: Zero-Knowledge** | Tentar realizar uma ação na Aba 1 que dependa da Aba 2. | **Passou:** Falha esperada; abas comunicam-se apenas via AppState/PubSub. |
