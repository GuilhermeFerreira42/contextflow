# F6 — evidências de 22/11/2026

Repositório: ../contextflow2; branch main; base 9094137; entrega no commit F6
que contém o registro de 22/11 em docs/estado-atual.md. Windows, Node v22.12.0.

Resultados finais executados (saída 0):
- npm-test-final.log: 196 testes, 190 aprovados, seis ignorados, zero falhas.
- npm-e2e-final.log: 57/57 cenários CDP.
- playwright-refinamentos-final.log: 9/9 grupos, grade/altura/larguras/lateral,
  incluindo 5.000 vídeos sintéticos; capturas em capturas-refinamentos/.
- playwright-f6-final.log: 6/6 grupos com navegador real; configuração,
  estimativa/consentimento, lote sem legenda, geração/fila, leitura/cópia/histórico,
  cancelamento/retry, autenticação inválida e janela estreita.
- npm-build-final.log: typecheck e build.
- npm-verificar-final.log: nove verificações, TUDO OK.

capturas/: configuracao.png, estimativa.png, fila.png, historico.png,
biblioteca-com-resumo.png, erro-provedor.png e configuracao-estreita.png.
Estimativa e janela estreita foram inspecionadas visualmente.

integracao-f6.log: rodada anterior dos primeiros 12 testes F6. O teste de
reabertura e o quarto provedor estão na rodada final de npm test (13 testes F6).
Logs com inicial e eventuais falhas intermediárias são diagnóstico histórico,
não resultado final. npm-test-final.log foi substituído após corrigir as duas
contagens fixas de migrações no teste F5.

Provedores: servidores HTTP controlados e dados sintéticos. O navegador e a
persistência são reais; não houve geração em LLM/conta externos. DPAPI Windows
foi exercitado com chave sintética, nunca com credencial pessoal.
Não executados: modelos reais OpenAI/Anthropic/Ollama/compatível, Linux, nova
validação YouTube e aceite humano. Nenhuma evidência aqui substitui esses aceites.
Fonte canônica de estado: ../contextflow2/docs/estado-atual.md.

Commit final: 8434a25. Git status limpo em main após o commit.
