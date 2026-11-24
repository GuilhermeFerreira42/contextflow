# Painel horizontal de Visualização — 22/11/2026

Base51ba4a9; main limpa antes desta reformulação. Este commit é exclusivo do
frontend de produção, teste e documentação. Sem mudança de backend/banco/contrato.
Correções anteriores de prompt/capa em51ba4a9; evidências separadas em
prompt-painel-bd41a13/. F7 não iniciada. Mockup separado não veio anexado;
referência utilizada foi a composição textual detalhada do proprietário.

Resultados executados, saída0 (Windows/Node v22.12.0):
- playwright-visualizacao.log:4/4 novos grupos. Acesso único, teclado,
  fechar/Escape, espaço de leitura, todos os controles/restauros, arraste,
  persistência após navegação/reload/novo contexto com storage salvo,
  preservação de modo/filtros/seleção/leitura e larguras1440/1280/1024/768/390/320.
  Desktop: painel161,25px; tabela aberta597,5px/recolhida770,75px.
- cdp.log:57/57.
- refinamentos.log:9/9, incluindo5.000 vídeos e conservação de âncora/seleção.
- pos-f6.log:13 cenários,zero falhas.
- npm-test.log:238 testes,232 aprovados,seis ignorados,zero falhas.
- build.log:typecheck/compilação.
- verificar.log:nove OK,TUDO OK.

capturas/:desktop-aberto.png,desktop-recolhido.png e painel em1280/1024/768/390/320.
Desktop aberto e painel390 foram inspecionados visualmente. Conteúdo sintético.

npm-test-intermediario.log: falha temporal preexistente no teste F4. Ajustado
somente o teste: comprova que a intenção está gravada quando a chamada externa
começa, em vez de supor que ela não começou até o cliente ler o202. A fila de
produção permaneceu intacta. Não confundir rodada intermediária com final.

Restaurar padrões geral: colunas/larguras/altura/fonte. Preserva modo escolhido,
seleção,filtros,ordenação e leitura da transcrição. Aberto/fechado não é salvo
no reload; valores são. IDs existentes reutilizados, sem controles paralelos.
Não executados:Linux,homologação humana,nova IA real. Dados pessoais não usados.
Atualizar página para carregar novo frontend. Próxima ação:homologação do dono;
não iniciar F7 sem autorização.

Commit final c3e8286; main limpa após commit. Correções anteriores:51ba4a9.
