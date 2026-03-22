# FASE 5.6: BLINDAGEM OPERACIONAL (OVERVIEW)

> **LEIA ISTO PRIMEIRO**
> Este documento é a fonte primária de verdade para entender *o que* é a Fase 5.6 e *por que* ela bloqueia a Fase 6.

## 1. O Que é a Fase 5.6?

A Fase 5.6 não é uma atualização de funcionalidades. É uma **operação de sobrevivência**.
Ela consiste em um conjunto de regras, contratos e implementações técnicas focadas exclusivamente em duas coisas:

1.  **Blindagem da Extração:** Garantir que o sistema continue baixando dados mesmo sob hostilidade ativa do YouTube (Bloqueios 429, mudanças de layout).
2.  **Governança de IA:** Garantir que o uso de LLMs seja economicamente previsível e sustentável, impedindo "queima de dinheiro" acidental.

## 2. Por Que Ela Existe?

Sem a Fase 5.6, a Fase 6 (Insights e Resumos) é inviável porque:

*   **Risco de Extração:** Se a extração falhar (bloqueio de IP), não há dados para analisar. O sistema morre na entrada.
*   **Risco Econômico:** Sem controle de custos e cache, um loop de reprocessamento ou um usuário empolgado pode gerar custos exorbitantes de API em minutos.

## 3. O Que Ela VAI Entregar

*   **Resiliência:** Sistema de rotação de identidade e persistência de cookies.
*   **Previsibilidade:** Estimativa de token *antes* da execução.
*   **Segurança:** Travas automáticas (Kill Switch) para custos e erros.
*   **Observabilidade:** Métricas reais de TTI (Time To Insight) e Taxa de Sucesso.

## 4. O Que Ela NÃO É (Escopo Negativo)

*   ❌ **NÃO é UX:** Não haverá redesenho de telas, apenas ajustes funcionais mínimos.
*   ❌ **NÃO é Otimização de Prompt:** Não buscaremos o "resumo perfeito", apenas o fluxo seguro.
*   ❌ **NÃO é Feature:** O usuário não verá botões novos "legais", apenas estabilidade.

## 5. Status da Fase 6

A Fase 6 está **BLOQUEADA**. Não se deve escrever uma linha de código para "Resumos" ou "Chat" até que os critérios de aceite da Fase 5.6 (definidos em `STRATEGY.md`) sejam 100% atendidos.
