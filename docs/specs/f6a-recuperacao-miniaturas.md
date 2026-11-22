# F6-A — recuperar capas indisponíveis

Status: implementado; caso relatado recuperado na aplicação real e testes
controlados aprovados no Windows. Resultados completos em `estado-atual.md`.

Pedido: vídeo importado sem imagem; converter miniaturas se necessário.
Base `adb6c57`, main limpa. Não iniciar F7 nem alterar vídeos/transcrições/resumos.

## Diagnóstico executado

No vídeo relatado, `videos.miniatura_url` aponta para uma capa localizada
`/vi_lc/<id>/maxresdefault_en-US.jpg`. Cache registra HTTP404 e três tentativas;
a listagem então devolve miniatura nula. O mesmo ID tem JPEG padrão disponível:
GET real em `/vi/<id>/maxresdefault.jpg` e `/hqdefault.jpg` respondeu 200,
image/jpeg. Não é evidência de formato incompatível, portanto conversão não
é necessária neste caso nem justifica dependência nova.

## Correção

- Reutilizar o serviço/cache local. Para URL de CDN YouTube e ID válido, tentar
  a URL original e as versões JPEG padrão maxres/hq, sem duplicatas. No máximo
  três candidatos por recuperação; manter limite de tentativas automáticas e
  deduplicação de buscas simultâneas. Não inferir URLs para fonte arbitrária.
- Quando houver fallback visual, oferecer ação explícita Tentar carregar
  miniatura. Reutilizar POST buscar com `forcar:true`, inclusive após falhas
  antigas; desabilitar durante a busca. Não gerar repetição automática infinita.
  Manter botão de leitura e seleção independentes. Falha continua declarada.
- Guardar a imagem como JPEG/PNG/WebP/GIF suportado e servir pela própria origem.
  Leitura do download limitada a 4 MB mesmo sem Content-Length, timeout existente.
  Não baixar áudio/vídeo, não alterar metadados de origem nem acrescentar migração.
- A rota estável por vídeo deve revalidar por ETag/no-cache, evitando conservar
  uma capa substituída como immutable. Detalhe e listagem usam o mesmo cache.
- Reparar o cache do vídeo relatado com o serviço corrigido, usando somente o
  cache existente e as imagens públicas; verificar pela API/navegador local.

## Prova e limites

Integração HTTP controlada: URL localizada404 → padrão200, maxres404 → hq200,
limite/sem laço, chave de origem arbitrária sem candidatos inventados, persistência,
arquivo local ausente e stream acima do limite. Playwright: erro remoto,
botão recuperar (também depois de cache esgotado), imagem decodificada, reload
e leitura/seleção preservadas. Prova real: JPEG público do vídeo relatado salvo
e servido, sem copiar banco pessoal para evidências. Registrar falhas reais.
Rollback do código conserva cache anterior e dados; sem migração.
