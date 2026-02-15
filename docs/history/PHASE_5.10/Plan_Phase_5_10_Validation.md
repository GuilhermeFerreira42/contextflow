# PLANO DE VALIDAÇÃO: PHASE 5.10 (Estresse e UX sem Fricção)

> **Status:** SSoT (Fonte Única de Verdade)  
> **Objetivo:** Validar a estabilidade do motor de concorrência, a eficiência do cache de snapshot para 10.000 itens e a eliminação de fricções na jornada do usuário.  
> **Referências:** Auditoria 360º, RNFs de Estresse e Protocolo QA2.

---

## 1. Testes de Estabilidade Industrial e Performance (10k)

O sistema deve operar em alta densidade técnica sem degradação de recursos ou travamentos de banco de dados.

| ID | Caso de Teste | Procedimento | Critério de Sucesso |
| :--- | :--- | :--- | :--- |
| **P01** | **Escalabilidade 10k** | Carregar biblioteca de 10.000 itens e realizar scroll rápido. | **60 FPS** estáveis; latência de célula < 0.1ms. |
| **P02** | **Cache de Snapshot** | Realizar mutações (adição/deleção) e medir o tempo de TTI. | Resposta da interface em **< 50ms** mesmo em bibliotecas massivas. |
| **P03** | **Worker Pool (CPU)** | Iniciar ingestão massiva (ex: playlist 200 vids) via ThreadPoolExecutor. | Uso de CPU reduzido em 15%; **zero erros** de "Database is locked". |
| **P04** | **Gestão de RAM** | Monitorar consumo durante scroll de 10k itens com LRU Cache ativo. | RAM mantida estritamente **< 250MB**. |

---

## 2. Validação de Fricção e UX (Jornada do Usuário)

O foco é a redução da carga cognitiva e a fluidez operacional do "Analista Solo".

| ID | Caso de Teste | Procedimento | Critério de Sucesso |
| :--- | :--- | :--- | :--- |
| **U01** | **Jornada de Exclusão (Undo)** | Selecionar 20 vídeos e clicar em excluir. | **Zero modais obstrutivos**; Snackbar com botão "Desfazer" visível por 5s. |
| **U02** | **Modo de Triagem (Toggle)** | Ativar "Modo Manual" e navegar por setas no Cockpit. | Splitter permanece estático; **zero jitter** de layout durante navegação rápida. |
| **U03** | **Feedback de Esforço** | Colar lista de URLs e clicar em "Processar Fila". | **Loading Gauge** exibe progresso imediato da resolução das URLs. |
| **U04** | **Diagnóstico Visual (Logs)** | Provocar um erro 429 ou falha de rede. | Mensagem de erro aparece instantaneamente em **Vermelho** no console. |
| **U05** | **Triagem de Tags** | Observar a coluna de Tags em diferentes temas. | Cores de fundo derivam do hash do nome; legibilidade absoluta sobre fundo branco. |

---

## 3. Validação de Governança e Configurações

Garantir que os limites impostos protegem o capital e o hardware do usuário.

| ID | Caso de Teste | Procedimento | Critério de Sucesso |
| :--- | :--- | :--- | :--- |
| **G01** | **Persistência JSON** | Salvar chaves de API, fechar e reabrir o sistema. | Credenciais e limites de concorrência carregados corretamente de `credentials.json`. |
| **G02** | **Teto de Concurrência** | Configurar limite de 1 worker para Ollama (Local). | O sistema processa apenas um vídeo por vez, evitando o congelamento da UI. |
| **G03** | **Integridade Financeira** | Deletar um vídeo que já possui log de custo no banco. | O registro na `ai_usage_log` **permanece intacto** para auditoria. |

---

## 4. Critérios de Homologação (Definition of Done)

A **Fase 5.10** será considerada concluída para a entrada da **Fase 6** (IA Real) se:
1.  **Zero Bloqueios:** Nenhuma operação simultânea resultou em erro de escrita no SQLite.
2.  **Fluidez Tátil:** A exclusão massiva não exige mais do que um clique (padrão Undo).
3.  **Transparência Técnica:** O usuário consegue identificar falhas apenas pela cor do log sem ler a mensagem técnica.
4.  **Consistência Visual:** O sistema inicia 100% em fundo branco, sem "flashes" escuros na Aba 3.

---
**Assinatura Técnica:** Engenharia ContextFlow - Estabilidade Industrial Validada.
