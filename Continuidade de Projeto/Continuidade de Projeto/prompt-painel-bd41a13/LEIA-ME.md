# Prompt personalizado e painel — base bd41a13 — 22/11/2026

Windows, Node v22.12.0. Estado/SPEC em ../contextflow2/docs/.
Resultados com saída0:
- integracao-resumos.log:16/16, inclui salvar comando sem marcador, reabrir
  motor de teste e gerar via HTTP controlado com as instruções e transcrição.
- npm-test.log:238 testes,232 aprovados,seis ignorados,zero falhas.
- playwright-resumos.log:8/8, inclui prompt personalizado/reload, falha de
  gravação sem perder edição e carga inicial atrasada sem sobrescrever texto.
- playwright-capas.log:3/3, simula detalhe de motor anterior com URL remota404,
  mas cache local disponível; painel tem de decodificar a capa local.
- build.log e verificar.log:typecheck/build e nove verificações,TUDO OK.
- painel-real.log/painel-real.png:painel na aplicação local decodificou a
  capa1280×720 pela própria origem. Nenhum prompt/chave pessoal foi substituído.
Capturas controladas em resumos/ e capas/.

Comandos pessoais anteriores não salvos não foram recuperados; API aberta
retornava o padrão. A falta de marcador era uma condição de rejeição, sem
presumir que explica todo o relato. Frontend agora inclui a fonte automaticamente,
mostra estado de edição e usa a resposta salva. Painel prefere cache por ID.
Não executados:Linux,IA real,gravação de prompt pessoal,nova regressão CDP completa.
Próxima tarefa autorizada:painel horizontal de Visualização, em commit separado.

Commit desta correção:51ba4a9. Painel Visualização posterior:c3e8286, com evidência própria.
