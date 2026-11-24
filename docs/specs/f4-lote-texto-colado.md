# F4 — Importar vídeos a partir de texto colado

Biblioteca e Importações aceitam texto livre no modo de lote. O motor
extrai URLs HTTP/HTTPS, valida com o normalizador de vídeo existente,
preserva a ordem da primeira ocorrência na lista do grupo e elimina duplicados
por ID. A execução segue o agendamento existente da fila.
Títulos, linhas de texto, outros domínios e páginas do YouTube sem vídeo
são ignorados. Sem vídeo válido, exibe erro e preserva o texto.

`POST /api/ingestao/lote` aceita `texto` como alternativa a `urls`.
Clientes com `urls` conservam a validação estrita. O texto bruto não
vai para a fila. A resposta informa vídeos, linhas sem vídeo e duplicatas.

O modal da Biblioteca oferece a seção recolhível Importar vários vídeos.
Cada tela guarda o estado de expansão no navegador. Os lotes entram na Biblioteca principal
e o cartão acompanha o grupo. Coleção e resumo automático continuam
disponíveis nos modos já suportados. Sem migração ou mudança na fila.

Validar texto misto, Markdown, duplicatas, ausência de vídeo e os dois
formulários, com integração e navegador controlado. Conferir o anexo
do proprietário localmente, sem enfileirar importações pessoais.
