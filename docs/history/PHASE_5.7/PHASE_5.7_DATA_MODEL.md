# PHASE 5.7 DATA MODEL (Integridade)

## 1. Estabilidade do Schema
*   **Declaração de Impacto:** **ZERO alterações** no Schema do Banco de Dados (`contextflow.db`).
*   **Justificativa:** A Fase 5.7 é uma refatoração puramente topológica de interface. O modelo de dados atual já suporta a segregação de abas.

## 2. Regras de Integridade Preservadas
*   **Unicidade:** O ID do YouTube permanece como a Chave Primária (`PRIMARY KEY`) imutável.
*   **Idempotência:** O sistema deve detectar URLs duplicadas e apenas atualizar o registro existente no DB (upsert), sem criar novas entradas na Grid por redundância de clique.
*   **Desacoplamento:** O Banco de Dados não possui conhecimento sobre qual aba está exibindo os dados. Ele serve apenas como o repositório central consultado pelo `AppState`.

## 3. Persistência de UI
*   As configurações de posição do *Sash* do Splitter (quando implementado o ajuste manual) deverão ser salvas opcionalmente via `ConfigManager` futuramente, sem afetar o modelo de dados de negócio.
