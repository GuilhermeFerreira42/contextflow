# F6-A — comando personalizado e imagem no painel

Status: implementado; integração16/16, Playwright resumos8/8 e capas3/3,
suíte238 (232 aprovados,seis ignorados), build/fumaça aprovados no Windows.
Imagem do painel real1280×720 comprovada; prompt pessoal não substituído.

Pedido do proprietário: prompt personalizado não permanece; capa da Biblioteca
não aparece no painel. Base `bd41a13`, main limpa. Sem iniciar F7.

## Evidência inicial e limites

API da aplicação aberta retornou prompt padrão; não há evidência de qual texto
personalizado o usuário havia digitado. A validação rejeita todo prompt sem
`{transcricao}`. Não presumir que essa foi a única causa: reproduzir e validar
persistência/reabertura com dados descartáveis, sem substituir o prompt pessoal.
A lista atual retorna capa local, mas o detalhe ainda retorna a URL original,
consistente com processo anterior à correção de composição; a capa local está
disponível. O painel não tenta esse cache por conta própria.

## Entrega

- Instrução personalizada não vazia pode omitir `{transcricao}`: acrescentar
  automaticamente `Transcrição:\n{transcricao}` uma única vez ao salvar. Não
  substituir instruções pelo padrão. Conservar tamanho máximo e reserva de
  contexto; mudanças continuam gerando fingerprint novo, sem alterar trabalhos
  já aceitos. Frontend normaliza também para funcionar com motor anterior.
- Salvar é explícito; mostrar alterações não salvas/salvando/salvo/erro. Impedir
  edição durante carga/salvamento, evitando resposta atrasada apagar o texto.
  Após POST bem-sucedido, usar a configuração retornada; falha preserva edição.
  Não persistir chave no navegador nem criar outro armazenamento de prompt.
- Painel prefere a rota local da imagem por ID, mesmo se o detalhe trouxer
  URL antiga. Se ausente, pedir recuperação uma vez e usar a fonte original
  como último recurso; falha mantém o fallback. Não repetir indefinidamente nem
  aplicar resposta atrasada ao painel de outro vídeo. Preservar seleção/leitura.

## Prova

API + reabertura do motor: comando sem marcador salvo, preservado e usado no
HTTP controlado com transcrição incluída. Playwright: personalizar/salvar/reload,
erro sem perder edição; atraso inicial não pode substituir texto; painel com
detalhe antigo e cache local, fallback e troca de vídeo. Conferir a imagem no
painel da aplicação real sem modificar instruções/segredos do proprietário.
Logs/capturas fora do Git, estado atualizado. Sem migração/dependência nova.
