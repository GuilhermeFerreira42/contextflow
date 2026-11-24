# Estabilização F6-B — 23/11/2026

Repositório: ../contextflow2 — base main 6c7fdef, entrega d74e3a9.
Commits por fatia:
- 59aedf2: autosave do comando; merge isolado, erro/revisões, Save manual.
- 484bfda: modal fecha no aceite; acompanhamento limpável/ocultável; área e barra responsiva.
- d74e3a9: alternativas limitadas de legenda, testes e documentação final.

Coleções intactas; paleta/árvore da Arena preservadas. F7 não iniciada.
Estado canônico: ../../contextflow2/docs/estado-atual.md (partindo desta pasta).

## Prova executada

- npm-test-base.log: 248 testes, 242 passaram, seis skips Windows, zero falhas.
- npm-test-final.log: 258 testes, 252 passaram, seis skips Windows, zero falhas.
- browser.log: 57/57 CDP.
- resumos.log: 8/8 Playwright; provedor HTTP controlado, não geração real.
- pos.log: 13/13 Playwright.
- refinamentos.log: 9/9 Playwright; fixture de 5.000 vídeos.
- visualizacao.log: 4/4 Playwright.
- estabilizacao.log: 9/9 Playwright; npm run test:e2e:estabilizacao.
- build.log: typecheck e build concluídos.
- checks.log: npm run verificar, TUDO OK.
- Capturas acompanhamento-*.png: card com título longo sem overflow horizontal.
- Capturas barra-*.png: barra em 1440/768/390/320px, com e sem seleção.

A nova suíte verifica autosave sem salvar campos alheios, recarga, erro,
resposta atrasada + Save manual, importação bloqueada depois do aceite202,
vínculo de coleção, fechar/ocultar sem cancelar, limpeza sem apagar histórico
ou trabalhos ativos, formulário reaberto protegido contra resposta antiga.
Todos esses dados de navegador são descartáveis, não a biblioteca pessoal.

## Dois vídeos reais

legendas-reais.log: adaptador atualizado baixou es-orig nos dois vídeos.
reparo-parciais-reais.log: fila do aplicativo existente reimportou sequencialmente
cL25NruYopo (223 segmentos) e zF1ZdfSTG_w (390 segmentos), idioma explícito es-orig.
Ambos agora prontos, transcrições prontas/auto, sem motivo de indisponibilidade.
O erro anterior era429. Configuração de IA preservada antes/depois (comparação
sem expor o comando pessoal ou chaves); nenhuma geração paga solicitada.

O aplicativo pessoal não foi reiniciado. Reabrir para carregar o motor novo;
reparo pessoal foi pela API existente, sem escrita direta no banco. Não prometer
que toda faixa-orig seja idioma original nem sucesso permanente contra limites.
Homologação humana da UI/geração real continua pendente.

## Reproduzir

Em contextflow2/platform: npm test; npm run test:e2e; npm run test:e2e:resumos;
npm run test:e2e:pos-f6; npm run test:e2e:refinamentos;
npm run test:e2e:visualizacao; npm run test:e2e:estabilizacao;
npm run build; npm run verificar. Playwright usa Chromium/Chrome instalado.
Não usar dados pessoais para testes de configuração ou limpeza de histórico.
