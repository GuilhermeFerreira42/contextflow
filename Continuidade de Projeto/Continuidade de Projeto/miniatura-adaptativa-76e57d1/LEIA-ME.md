# Miniatura adaptativa — correção sobre 76e57d1 — 22/11/2026

Repositório ../contextflow2, branch main. Estado/SPEC versionados em docs/.
Windows, Node v22.12.0. Todos os dados usados são fixtures descartáveis.

Reprodução no HEAD recebido: reproducao.log, 2/3 grupos. Ao subir linha 296→304,
a imagem diminuiu de 484 para 423 px na troca para empilhado. A base já havia
retirado o teto antigo; não confundir a captura anterior com todo o HEAD.
antes/: capturas e medidas anteriores; o título usado na matriz final ficou
mais longo para exigir as duas linhas visíveis e subtexto.

Resultados finais (saída 0):
- playwright-miniatura.log: 4/4 grupos, slider e resize reais. Crescimento sem
  recuo; título abaixo/sem sobreposição; 45 combinações de três alturas, cinco
  larguras e três conteúdos (curto, longo, fallback); Compacto, seleção, reload.
- pos-f6-final.log: 13 cenários, zero falhas. Executável existente também no
  Windows; limite rígido 120px em 200px de linha substituído por não sobrepor
  título (o novo teste mede crescimento e texto contido).
- refinamentos.log: 9/9, incluindo 5.000 vídeos e conservação da âncora.
- resumos.log: 7/7, geração com servidor HTTP controlado.
- cdp.log: 57/57.
- npm-test.log: 232 testes, 226 aprovados, seis ignorados, zero falhas.
- build.log: typecheck/compilação.
- verificar.log: nove verificações, TUDO OK.

Capturas finais e medidas em depois/. linha-alta-apos-reload.png foi
inspecionada visualmente: título abaixo, imagem contida na coluna. Coluna
1100/linha600: 905×509px. Coluna700: 678×381px, limitada pela largura útil.
Capturas da suíte pós-F6 em pos-f6/, das demais em refinamentos/ e resumos/.
playwright-pos-f6.log é a falha inicial por caminho Linux inexistente;
pos-f6.log é a rodada intermediária com a antiga expectativa fixa de 120px.
Falhas intermediárias não são resultado final.

Não executados: Linux, serviços YouTube/LLM reais, banco pessoal e homologação
humana. Python original preservado. Backend, banco e preferências não alterados.
Para instalar: fonte exige reload da página; se rodando dist, rebuild/reinício.

Commit final adb6c57; main limpa após commit.
