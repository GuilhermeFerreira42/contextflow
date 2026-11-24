# Recuperação de capas — 22/11/2026 — base adb6c57

Estado e SPEC em ../contextflow2/docs/. Main limpa no início.
Diagnóstico real: URL localizada de capa404; cache com três falhas, listagem
retornando imagem nula. JPEG padrão maxres e hq do mesmo vídeo responderam200.
Nenhuma conversão/dependência nova necessária.

Prova real (sem copiar banco pessoal):
- recuperacao-real.log: serviço corrigido gravou somente cache/tabela miniaturas;
  JPEG138445bytes, rota local200.
- navegador-real.log: Biblioteca da aplicação aberta na porta4780 exibiu imagem
  decodificada1280×720, proveniente da rota local.
- capa-real.png: recorte da célula, inspecionado visualmente.
O vídeo, a transcrição, resumos e credenciais não foram alterados. Não houve
nova importação yt-dlp nem geração de resumo. Reiniciar motor/recarregar para
ativar a política nova do backend nas próximas falhas; o cache reparado já é
visível no processo aberto.

Resultados finais com saída0 (Windows/Node v22.12.0):
- npm-test-final.log:237 testes,231 aprovados,seis ignorados,zero falhas.
  Cinco testes novos de variantes/cache/deduplicação/limites/arquivo apagado.
- playwright-capas-final.log:3/3 grupos; servidor HTTP controlado, Chromium real,
  decodificação, recuperar cache esgotado, leitura/seleção/reload, falha sem laço.
- playwright-layout.log:4/4; miniatura adaptativa preservada.
- cdp.log:57/57.
- build.log:typecheck e compilação.
- verificar.log:nove OK,TUDO OK.
Capturas controladas em capturas/; regressão de layout em layout/.

integracao.log é a primeira rodada com quatro testes. npm-test.log e
playwright-capas.log são rodadas intermediárias (incluíram detecção de uma
imagem sobrepondo o botão de leitura, corrigida por pointer-events). Uma rodada
unitária sob carga revelou asserção temporal antiga da fila; rodada seguinte
acusou expectativa immutable antiga. O teste de cache passou a exigir ETag e
revalidação, pois rota da imagem não muda por arquivo. Não confundir esses
resultados com os logs finais acima.

Não executados: Linux, nova importação YouTube, IA real ou nova rodada completa
pós-F6/refinamentos/resumos. Esses roteiros estão nas evidências da entrega anterior.

Commit final bd41a13; main limpa após commit.
