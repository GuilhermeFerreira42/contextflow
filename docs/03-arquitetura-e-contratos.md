# Arquitetura-alvo — monólito modular Node.js + TypeScript

## Forma geral

```
platform/
├── src/
│   ├── motor/            # API HTTP + regras de negócio (Node.js)
│   │   ├── nucleo/       # bootstrap, config, logging, erros, relógio
│   │   ├── modulos/      # biblioteca, ingestao, trabalhos, resumos, configuracao
│   │   ├── persistencia/ # conexão, migrações, repositórios
│   │   └── integracoes/  # ytdlp.ts (processo) · legendas.ts (normalização)
│   ├── interface/        # frontend web local (servido pelo motor)
│   │   ├── paginas/      # Biblioteca, Leitura, Importações, Configurações
│   │   ├── componentes/  # tabela virtualizada, painel de leitura, atividade
│   │   └── estilos/      # tema grafite escuro + azul
│   └── compartilhado/    # tipos e contratos usados por motor e interface
├── testes/               # unitários, integração, E2E (CDP em navegador real)
├── scripts/              # dev, build, start, verificação por SO
├── package.json · tsconfig.json · *.config.*
└── dados/                # runtime, FORA do Git (configurável pelo usuário)
```

**Uma única fonte de verdade por dado.** Nenhum módulo importa detalhes internos de
outro: a comunicação passa por contratos explícitos exportados pela API pública do módulo.

## Fronteiras (módulos e responsabilidades)

| Módulo | Responsabilidade | Não faz |
|---|---|---|
| `biblioteca` | vídeos, canais, playlists/coleções, marcações, filtros, consulta paginada | não baixa nada, não chama IA |
| `ingestao` | aceitar links, inspecionar vídeo/playlist, metadados, obter legenda, normalizar segmentos | não grava direto; devolve dados ao módulo dono |
| `trabalhos` | fila **persistente**, estados, concorrência limitada, cancelamento, retry idempotente | não conhece regra de negócio de vídeo |
| `resumos` | orquestra prompts/modelos, proveniência, status, custos estimados | não renderiza, não lê tela |
| `configuracao` | preferências, endpoints, credenciais de forma segura | não expõe segredo em log/exportação |
| `persistencia` | repositórios e migrações, transações | não contém regra de negócio |
| `interface` | renderização virtualizada, seleção, leitura, busca, preservação de estado de navegação | **não é dona dos dados**; não executa yt-dlp nem acessa chaves |

## Modelo de dados conceitual (não é SQL final)

- `Video(id interno imutável, youtubeId, title, channelId/nome, duration, url, thumbnail, playlistRefs, createdAt, ...)`
- `Transcript(videoId, language, source = manual|auto|importado, status, segments:[{startMs,endMs,text}], rawArtifact?)`
- `Summary(videoId, provider, model, promptVersion, transcriptRevision, text, status, error, timestamps)`
- `Job(id, type, scope, status, attempts, progress, error, timestamps)`
- `Collection(id, title, videoIds)`
- `Preferences` e `Secrets` armazenados **separadamente** (segredo nunca junto de preferência comum)

## Contratos de exemplo (não são APIs fechadas)

- `Ingestion.request(url)` → devolve ID de job; `Jobs.get(jobId)` → estado real persistido.
- `TranscriptRepository.find(videoId, language?)` → trechos ordenados com timestamps e origem.
- `Summary.request(videoIds, modelId, promptId)` → jobs rastreáveis e status.
- `Library.query({search, filters, sort, cursor, limit})` → linhas virtualizáveis com chave estável.
- A **interface** não executa yt-dlp nem acessa chaves diretamente.

## Fluxos e falhas

```
URL → validação/normalização → deduplicação → metadados (yt-dlp) → legenda (yt-dlp)
   → persistir → notificação de estado → UI
Resumo: transcrição persistida (revisão) → job → provedor → Summary + custo/erro
```

- Sem legenda → estado `unavailable` explícito; **não** há Whisper compulsório.
- Queda de rede/processo → jobs recuperáveis; **nunca** duplicar vídeo.
- Cancelamento **cooperativo**; dados já concluídos são preservados.
- Chaves, dados pessoais e cookies **não saem** em logs nem em pacote.
- Servidor faz **bind local** por padrão; exposição remota exigiria decisão e autenticação.

## Integração com yt-dlp (implementada na F3)

Arquivos: `integracoes/ytdlp.ts` (processo) e `integracoes/legendas.ts` (normalização).

- Executado por `spawn` com **array de argumentos** e `shell: false` — nunca concatenar
  URL em string de shell. Há teste de injeção: uma URL com `;` e `` ` `` não executa nada.
- `--dump-single-json --skip-download` para metadados; `--write-subs` (manual) ou
  `--write-auto-subs` (automática) em diretório `mkdtemp` próprio, **removido no
  `finally`** mesmo em erro. `--sub-format vtt/json3`.
- Timeout por operação (padrão 60 s) com `SIGKILL` real no processo filho.
- Erro do yt-dlp é traduzido para erro de domínio com código estável; o texto cru vai
  apenas para o log. **A ordem das regras de tradução importa:** rede/TLS é avaliada
  antes de restrição de idade — um erro de rede contém "unable to download" e a
  palavra "page" contém "age".
- Binário: `CONTEXTFLOW_YTDLP` → `yt-dlp` no PATH. Se ausente, `503` com instrução de
  instalação; o app inteiro continua funcionando.

### Prioridade de legenda

Manual primeiro; automática só na ausência de manual. O idioma é escolhido por lista
de preferência (`CONTEXTFLOW_IDIOMAS`, padrão `pt-BR,pt,en`), com correspondência exata
antes de prefixo de idioma. A origem (`manual`/`auto`) é **persistida e exibida** —
o usuário precisa saber o que está lendo.

### Quando não há legenda

Não é erro. A transcrição fica `indisponivel` com `motivo` legível, e o vídeo fica
`parcial` (metadados valem, transcrição não). Nunca se marca `pronto` sem segmento
gravado — o escopo canônico proíbe fingir conclusão.

## Portabilidade

Node suporta Windows/Linux, mas yt-dlp, paths, permissões e instaladores **precisam** de
scripts e testes reais por SO. Não prometer instalação cross-platform sem evidência; a
F1 entrega o esqueleto reproduzível e a F9 a verificação por SO (ou limitação declarada).

## Evolução para V2 (somente previsão)

IDs de conteúdo, segmentos e revisões permitem referência de fonte. Contrato de conteúdo
consultável pode ser criado quando V2 for especificada. **Não** introduzir RAG, vetores,
sessão e memória de chat antecipadamente.
