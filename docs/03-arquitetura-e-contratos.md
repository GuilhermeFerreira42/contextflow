# Arquitetura-alvo — monólito modular Node.js + TypeScript

## Forma geral

```
platform/
├── src/
│   ├── motor/            # API HTTP + regras de negócio (Node.js)
│   │   ├── nucleo/       # bootstrap, config, logging, erros, relógio
│   │   ├── modulos/      # biblioteca, ingestao, trabalhos, resumos, configuracao
│   │   ├── persistencia/ # conexão, migrações, repositórios
│   │   └── integracoes/  # adaptadores externos (yt-dlp, provedores de IA)
│   ├── interface/        # frontend web local (servido pelo motor)
│   │   ├── paginas/      # Biblioteca, Leitura, Importações, Configurações
│   │   ├── componentes/  # tabela virtualizada, painel de leitura, atividade
│   │   └── estilos/      # tema grafite escuro + azul
│   └── compartilhado/    # tipos e contratos usados por motor e interface
├── testes/               # unitários, integração, E2E (Playwright)
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

## Integração com yt-dlp (decisão)

- Executado por `spawn` com **array de argumentos** e `shell: false` — nunca concatenar
  URL em string de shell.
- `--skip-download` para inspeção/metadados; legendas obtidas por `--write-subs`/
  `--write-auto-subs` em diretório temporário próprio, e removidas após normalização.
- Timeout explícito por operação e mensagem de erro traduzida para o usuário.
- Binário: preferir yt-dlp presente no PATH; se ausente, a aplicação informa condição e
  falha de forma explícita (ver limitação em `04-plano-mestre.md`).

## Portabilidade

Node suporta Windows/Linux, mas yt-dlp, paths, permissões e instaladores **precisam** de
scripts e testes reais por SO. Não prometer instalação cross-platform sem evidência; a
F1 entrega o esqueleto reproduzível e a F9 a verificação por SO (ou limitação declarada).

## Evolução para V2 (somente previsão)

IDs de conteúdo, segmentos e revisões permitem referência de fonte. Contrato de conteúdo
consultável pode ser criado quando V2 for especificada. **Não** introduzir RAG, vetores,
sessão e memória de chat antecipadamente.
