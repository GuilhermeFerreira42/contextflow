# PHASE 5.7 DATA MODEL (Integridade)

## 1. Estabilidade do Schema
Confirmamos que nesta fase de saneamento de interface, **NÃO haverá alterações** na estrutura do banco de dados SQLite (`contextflow.db`). O foco é puramente topológico e organizacional na camada de visão (View).

## 2. Preservação da Unicidade
*   **Chave Primária:** O `id` (YouTube Video ID) permanece como o identificador único e soberano.
*   **Regra de Migração:** Durante a refatoração das abas, a lógica de "Upsert" deve ser rigorosamente mantida. O sistema nunca deve criar registros duplicados caso uma URL seja reinserida na Aba 1.
*   **Integridade Referencial:** A separação das abas não deve quebrar os filtros por Playlist ou as consultas de histórico carregadas pelo `AppState`.

## 3. Fluxo de Dados
A `VirtualVideoTable` na Aba 2 continuará consumindo a lista de dicionários fornecida pelo `AppState`, sem necessidade de novos campos ou tabelas temporárias.
