# Escopo canônico — V1

## Objetivo de produto

Biblioteca pessoal local para importar vídeos do YouTube, preservar metadados e
transcrições com tempos, gerar/consultar resumos com IA, agrupar e ler grandes volumes
de conteúdo. A experiência de **alta densidade, formato planilha e leitura contínua**
é central.

## V1 — compromissos funcionais

- **Biblioteca**: tabela densa/virtualizada, miniatura, título, canal, duração, data,
  estado, status de resumo, classificação por canal e playlist; pesquisa, filtros,
  ordenação, seleção múltipla e ações em lote consistentes. Coleções podem morar dentro
  da Biblioteca, sem aba própria no nível superior.
- **Leitura**: lista tipo planilha com células amplas; modos Resumos, Transcrições e
  Ambos; expansão por linha com altura máxima sensata; ação "Abrir leitura completa",
  visor amplo e rolável, busca/cópia; preservar filtros, seleção, expansão e posição de
  scroll ao voltar.
- **Importações**: URLs individuais e lote/playlist; progresso, filas, cancelamento,
  erros compreensíveis, retomada segura, deduplicação e retry. Não bloquear a UI.
- **Transcrições**: preferir legenda manual fornecida pelo YouTube e depois automática;
  manter idioma, proveniência e segmentos com tempo inicial/final; não exigir download
  do vídeo completo quando desnecessário. Sem legendas: **estado explícito**, não fingir
  conclusão; fallback Whisper é opcional e posterior, não obrigatório em V1.
- **Resumos**: provedores e modelos configuráveis; processar texto sob solicitação ou
  lote, indicar custos estimados quando possível e limites/erros; preservar texto-fonte
  e metadados; **não sobrescrever silenciosamente** dados existentes.
- **Configurações**: provedor, modelo, prompt, chave/endpoint, pasta de dados,
  preferências visuais; segredos protegidos, excluídos de logs/exportações.
- **Visual**: tema grafite escuro com detalhes azuis; navegação principal Biblioteca,
  Importações e Configurações; leitura integrada à Biblioteca na linha e no painel
  sobreposto; atividade global discreta. Composição aprovada na SPEC F5-UI;
  as capacidades de leitura previstas para V1 permanecem obrigatórias.
- **Operação local**: Node.js + TypeScript, interface web local; suporte-alvo Windows e
  Linux, instalação/execução reproduzível; funcionalidades que dependem da
  internet/serviços externos informam condição e falha.

## V2 — fora do escopo de aceite da V1

Chat com conteúdo ao estilo NotebookLM, isolamento de conversas, recuperação
contextual/RAG, memória do chat e citações. Preparar identificadores estáveis, fonte de
verdade e limites entre módulos para futura extensão; **NÃO implementar** serviços de
memória/RAG/chat em V1.

## Decisões resolvidas (não inferir diferente)

| Tema | Decisão | Origem |
|---|---|---|
| Stack do motor | Node.js 22 + TypeScript | decisão do proprietário |
| Interface | Web local servida pela própria aplicação | decisão do proprietário |
| Arquitetura | Monólito modular, módulos independentes | decisão do proprietário |
| Extração de legenda | **yt-dlp** via subprocesso (não API não-oficial do YouTube) | decisão do proprietário |
| Inspeção de vídeo unitário | **yt-dlp** com `--skip-download`; API pública/timeout para playlists | decisão do proprietário |
| Download de mídia | Fora do V1 (Whisper fora do V1 obrigatório) | escopo |
| Chat/RAG | V2 | escopo |
| Banco | SQLite via `node:sqlite` nativo; driver isolado em `persistencia/banco.ts` | decisão final medida e registrada na SPEC F2 |
| ORM | Sem ORM; repositórios próprios sobre o adaptador SQLite | SPEC F2 e implementação vigente |

## Não inferir sem nova decisão

Formatos de exportação obrigatórios, limites quantitativos de performance, política de
download de mídia, níveis de permissão e integrações adicionais exigem investigação
(E0) e decisão registrada. Preferências visuais são aprovadas conceitualmente; desenhos
exatos dependem de homologação.
