
**Plano de Migração de Dados (Crítico)**
1.  **SQLite Atomic Evolution:** No `DatabaseManager`, implementar verificação de versão. Executar `ALTER TABLE videos ADD COLUMN input_tokens INTEGER` e criar tabela `summaries` caso não existam.
2.  **Credentials Migration:** Script para converter `credentials.json` do formato v32 para a nova estrutura de 7 provedores, preservando chaves de API existentes.

**Ordem Sequencial de Implementação**
1.  **Core:** Implementar `AIFactory` e `TokenEngine` funcional (Zero-Knowledge).
2.  **Persistência:** Rodar scripts de migração de banco e JSON.
3.  **UI Foundation:** Implementar o `Renderizador de Fallback` e o `Live Context` no `AppState`.
4.  **Batch Engine:** Criar o controlador de processamento em lote com "Pre-flight Check" de custos.
5.  **Integration:** Conectar o botão de resumo individual e o seletor dinâmico do Ollama.

**Critérios de Aceite (Gherkin)**
*   **Cenário:** Falha de WebView no Windows.
    *   **Dado** que o sistema não detecta o WebView2 no Windows.
    *   **Quando** um resumo é iniciado.
    *   **Então** o sistema deve renderizar o texto no componente de fallback (`wx.TextCtrl`) sem travar a aplicação.
*   **Cenário:** Sincronia entre abas.
    *   **Dado** que um resumo está sendo gerado na Aba 2.
    *   **Quando** eu mudo para a Aba 3.
    *   **Então** o texto já gerado deve estar visível e continuar atualizando em tempo real.
