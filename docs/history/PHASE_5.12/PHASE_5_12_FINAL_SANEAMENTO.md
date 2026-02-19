Este documento serve como a **Fonte Única de Verdade (SSoT)** para a conclusão definitiva da **Fase 5.12**. O objetivo é sanear as inconsistências detectadas entre a interface e o motor de processamento, restaurar funcionalidades perdidas em regressões e preparar o terreno administrativo para a entrada da Fase 6.

---

# PHASE_5_12_FINAL_SANEAMENTO.md: Blindagem e Saneamento Final

> **Status:** SSoT (Fonte Única de Verdade)  
> **Objetivo:** Resolver os 30% pendentes da Fase 5.12 e eliminar dívida técnica residual.  
> **Referências:** Auditoria de Inconsistências, Checklist de Saída 5.12 e Mockup Operacional v2.

---

## 1. Correção de Inconsistências (Backend ↔ UI)

Para garantir que o motor respeite as ordens do console de governança, as seguintes alterações lógicas são mandatórias:

*   **Lógica de Fila (Aviso vs. Aborto):** O backend (`Processor`) deve abandonar o "Aborto Automático" para lotes grandes. Ao exceder `max_queue_warning`, o sistema deve disparar um sinal **PubSub** solicitando que a UI exiba um diálogo de confirmação manual ("Deseja processar este lote massivo?") antes de iniciar a extração.
*   **Vínculo da Grade Dinâmica:** O toggle de "Grade Dinâmica" na UI deve ser conectado à lógica de renderização da `VirtualVideoTable`. Se desativado, o sistema deve interromper o carregamento de miniaturas e o rendering rico para manter o uso de RAM **< 200MB**.
*   **Trava Mandatória do Ollama:** Independente da configuração de concorrência na UI, o backend deve impor uma trava rígida de **1 tarefa simultânea** para o provedor Ollama/Local para proteção de hardware.
*   **Sincronização de Insumos:** O método `update_physical_files()` no `ConfigManager` deve garantir que, se o campo de cookies estiver vazio, o arquivo `cookies.txt` físico seja removido para evitar falhas no `yt-dlp`.

## 2. Refinamento de Interface e Usabilidade (UX Pro)

A interface deve ser estabilizada para uso industrial, seguindo os padrões de acessibilidade e semântica administrativa:

*   **Acessibilidade e Layout:**
    *   **Tamanho do Diálogo:** Manter o tamanho atual (700x800) em vez de 800x600. Justificativa: Telas pequenas (ex: 800x600 nativo) não acomodam bem o redimensionamento, fazendo com que a tela de config ocupe o espaço todo.
    *   Implementar `wx.ScrolledWindow` em todas as abas para evitar campos escondidos em resoluções baixas.
    *   Aplicar `SetMinimumPaneSize(50)` em todos os splitters do sistema para evitar painéis presos na posição zero.
*   **Semântica Administrativa:** Renomear todos os campos técnicos para termos operacionais:
    *   "Cooldown" → **"Intervalo de Espera"**.
    *   "Erro 429" → **"Limite de Tentativas Falhas"**.
*   **Visualização de API Key:** Implementar o botão de alternância (ícone de olho) para mostrar/ocultar as chaves de API na Aba 2, garantindo que elas permaneçam mascaradas por padrão.
*   **Rodapé Operacional:** Implementar o rodapé informativo que exiba, em tempo real: "Proteção [Ativa/Inativa] | [X] Proxies Válidos | [Status de Cookies]".

## 3. Restauração Funcional e Botão Cancelar

*   **Recuperação das 3 Abas Mestras:** Consolidar o diálogo em:
    1. **Extração & Segurança** (4 blocos: Limites, Cookies, Rede, Idiomas).
    2. **Conectividade IA** (Credenciais OpenAI, Gemini, GROQ, Ollama).
    3. **Orquestração & Performance** (Pool de Threads, Grade Dinâmica, Persistência).
*   **Ativação do Botão Cancelar (Tab 1):** O botão de interrupção na Aba 1 deve ser devidamente vinculado ao método `clear_queue` do `Processor` via PubSub, garantindo a limpeza atômica da fila em tempo de execução [Conversa, 1144].

## 4. Checklist de Homologação (DoD)

A Fase 5.12 só será considerada **CONCLUÍDA** quando:

- [ ] O diálogo de configurações abrir em **800x600** com todas as 3 abas funcionais e restauradas.
- [ ] O arquivo `cookies.txt` for gerado fisicamente na raiz ao salvar o texto no formato Netscape.
- [ ] O processamento massivo (ex: 50 vídeos) exigir confirmação manual via popup antes de iniciar.
- [ ] O botão de cancelar na Aba 1 interromper imediatamente o worker loop do `Processor` [Conversa].
- [ ] O **Protocolo Zero-Knowledge** for respeitado (nenhuma aba importa classes de outra).
- [ ] As chaves de API forem mascaradas corretamente e salvas no `credentials.json`.

---

**Assinatura Técnica:** Engenharia ContextFlow - Saneamento Administrativo Validado.