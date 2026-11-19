# F3 — Ingestão real com yt-dlp e transcrições com tempo

> Status: **implementada e verificada tecnicamente**. Homologação humana
> pendente do teste real contra o YouTube (`docs/roteiro-teste-f3.md`).
> Pré-requisito: F2 concluída e **homologada pelo proprietário em 19/11/2025**. 

## 0. Resultado da implementação (registrado após execução)

| Item da spec | Situação |
|---|---|
| Adaptador yt-dlp com `spawn` e `shell:false` | ✅ `integracoes/ytdlp.ts` |
| Normalização VTT + JSON3 + rolagem | ✅ `integracoes/legendas.ts` |
| Repositório de transcrições | ✅ `persistencia/repositorio-transcricoes.ts` |
| Serviço de ingestão com dedup e estados | ✅ `modulos/ingestao/servico.ts` |
| Rotas `/api/ingestao/importar`, `/diagnostico`, `/api/biblioteca/:id/transcricao` | ✅ |
| Interface: Importações real + Leitura com tempo | ✅ |
| Migração de schema | **nenhuma necessária** — o schema da F2 já cobria |
| Suíte | **122/122** |
| E2E | **17/17** |

**Dois defeitos encontrados e corrigidos durante a verificação:**

1. `removerRolagem` comparava cada bloco com o texto **já recortado**, então
   rolagens de três níveis não eram removidas (`a` → `a b` → `a b c` virava
   `a`, `b`, `a b c`). Corrigido para comparar com o texto **cru** anterior.
2. A tradução de erro classificava falha de **TLS** como "restrição de idade",
   porque a regra de idade aceitava a palavra `age` em qualquer frase (e
   "page" contém "age") e a regra de rede vinha depois. Corrigido: rede/TLS
   é avaliada primeiro e a regra de idade exige frase explícita. Há teste de
   regressão com a mensagem real coletada.


## 1. Objetivo

Transformar o "importar URL" de hoje — que grava só o `youtubeId` com título
provisório — em **ingestão real**: buscar metadados do YouTube, obter a legenda
(manual e, na falta dela, automática), gravar **segmentos com tempo** e registrar
de forma **explícita** quando não há legenda.

A F3 **não** inclui fila persistente, concorrência e retry: isso é F4. Aqui a
importação é síncrona por requisição, com timeout, e devolve o resultado real.

## 2. Escopo da F3

**Entra:**

1. Adaptador `integracoes/ytdlp` que executa o binário via `spawn` com array de
   argumentos, `shell: false`, timeout e captura de `stderr`.
2. Metadados reais: título, canal (id e nome), duração, miniatura, data de
   publicação.
3. Legendas: preferir **manual**; se não houver, **automática**; idioma
   preferido configurável (padrão `pt-BR`, `pt`, `en`).
4. Normalização de formatos de legenda (VTT e JSON3 do YouTube) para
   `SegmentoTranscricao[]` com `inicioMs`/`fimMs`/`texto`, com
   deduplicação de sobreposição típica das legendas automáticas.
5. Persistência em `transcricoes` + `segmentos` dentro de **uma transação**.
6. Estado explícito `indisponivel` com `motivo` legível quando não há legenda.
7. Erros traduzidos: binário ausente, timeout, vídeo privado/removido, rede.
8. Interface: Importações mostra o resultado real e a origem da legenda;
   Biblioteca e Leitura mostram a origem (`manual`/`auto`) e permitem ler os
   segmentos com tempo.

**Não entra (fica para F4+):**

- Fila persistente, progresso por polling, cancelamento, retry automático.
- Importação de playlist (a F3 aceita **apenas vídeo unitário**).
- Whisper / transcrição por áudio.
- Resumos por IA (F6).

## 3. Decisões

| Decisão | Valor | Motivo |
|---|---|---|
| Como executar o yt-dlp | `spawn(binario, args, { shell: false })` | nunca concatenar URL em shell |
| Onde o binário é procurado | `CONTEXTFLOW_YTDLP` → `yt-dlp` no PATH | permite apontar caminho no Windows |
| Formatos de legenda | `--sub-format vtt/json3` | VTT é o mais estável; JSON3 tem tempos precisos |
| Escolha de idioma | lista configurável, padrão `pt-BR,pt,en` | brasileiro primeiro, inglês como fallback |
| Preferência manual vs auto | manual primeiro, auto só se não houver manual | exigência do escopo canônico |
| Timeout padrão | 60 s por operação | vídeo longo com legenda grande |
| Diretório de trabalho | `mkdtemp` próprio, apagado com `rm` no `finally` | nada vaza no disco |
| Transação | metadados + transcrição + segmentos juntos | nunca vídeo "pronto" sem legenda gravada |
| Quando falha a legenda | vídeo salvo com `estado = 'parcial'` e transcrição `indisponivel` | não perder os metadados já obtidos |

### Por que `parcial` e não `erro`

Se os metadados vieram mas a legenda não, o vídeo **existe** e é útil. Marcar
`erro` faria o usuário achar que nada foi importado. `parcial` comunica a
verdade: metadados sim, transcrição não.

## 4. Contratos

### 4.1 Módulo `ingestao` (novas assinaturas)

```ts
export interface ResultadoInspecao {
  youtubeId: string;
  titulo: string;
  canalId: string | null;
  canalNome: string | null;
  duracaoSegundos: number | null;
  miniaturaUrl: string | null;
  publicadoEm: string | null;
}

export interface ResultadoIngestao extends ResultadoInspecao {
  transcricao: {
    idioma: string;
    origem: 'manual' | 'auto';
    estado: 'pronta';
    segmentos: SegmentoTranscricao[];
  } | {
    estado: 'indisponivel';
    motivo: string;
  };
}

export interface ServicoIngestao {
  inspecionar(url: string): Promise<ResultadoInspecao>;
  importar(url: string): Promise<ResultadoIngestao>;
}
```

### 4.2 Adaptador `integracoes/ytdlp`

```ts
export interface ExecutorYtdlp {
  inspecionar(url: string, sinal?: AbortSignal): Promise<MetadadosYtdlp>;
  baixarLegenda(url: string, idiomas: string[], sinal?: AbortSignal): Promise<LegendaBaixada>;
}

export interface MetadadosYtdlp {
  id: string;
  titulo: string;
  canalId: string | null;
  canalNome: string | null;
  duracaoSegundos: number | null;
  miniaturaUrl: string | null;
  publicadoEm: string | null;
  legendasManuais: string[];   // idiomas disponíveis
  legendasAutomaticas: string[]; // idiomas disponíveis
}
```

O adaptador **não conhece banco nem HTTP**. Recebe URL, devolve dados ou lança
erro de domínio. É a única peça que fala com o processo externo — e é ela que os
testes substituem por um dublê.

### 4.3 HTTP

| Rota | Entrada | Saída |
|---|---|---|
| `POST /api/ingestao/validar` | `{ url }` | inalterado: `{ valido, youtubeId, urlNormalizada }` |
| `POST /api/ingestao/importar` | `{ url, idiomas? }` | `ResultadoIngestao` + registro criado |
| `GET /api/biblioteca/:id/transcricao` | — | `Transcricao` com segmentos |
| `GET /api/ingestao/diagnostico` | — | `{ ytdlp: { disponivel, versao, caminho }, idiomas }` |

`POST /api/biblioteca` **continua existindo** e continua sendo a escrita crua
(usada pelos testes e por integrações futuras). A interface passa a usar
`/api/ingestao/importar`.

## 5. Fluxo

```
URL
 → normalizarUrlVideo            (rejeita não-YouTube, sem rede)
 → já existe?  → 409 video_duplicado (dedup por youtube_id)
 → salvando vídeo estado='importando'
 → yt-dlp --dump-single-json --skip-download
     ├─ falhou → estado='erro', erro legível → 502
     └─ ok → metadados reais
 → há legenda?
     ├─ não → transcrição 'indisponivel' + motivo, vídeo 'parcial'
     └─ sim → yt-dlp --write-subs/--write-auto-subs --sub-format vtt/json3
          → normalizar segmentos
          → vídeo 'pronto' + transcrição 'pronta' + segmentos
 → resposta com o resultado real
```

Tudo em **uma transação** no final. Se a transação falhar, nada fica pela metade.

## 6. Normalização de legendas

### VTT

- Ignorar cabeçalho `WEBVTT`, blocos `NOTE`, `STYLE`, `REGION`.
- Bloco de tempo: `00:00:01.234 --> 00:00:03.456` (aceitar `,` como separador
  decimal e horas opcionais).
- Remover tags inline (`<c>`, `<00:00:01.234>`, `<v Nome>`).
- Entidades HTML (`&amp;`, `&#39;`) decodificadas.

### JSON3

- `events[].tStartMs` e `events[].dDurationMs`; texto em `segs[].utf8`.
- Ignorar eventos sem `segs`.

### Deduplicação das legendas automáticas

O VTT automático do YouTube repete a linha anterior no bloco seguinte (efeito de
rolagem). Regra: se o texto do bloco atual **contém** o texto do anterior como
prefixo, subtrair o prefixo repetido. Se sobrar vazio, descartar o bloco.

### Junção

Segmentos consecutivos com o mesmo texto e tempo encostado são fundidos; texto
final com espaços normalizados. `fimMs >= inicioMs` sempre (o `CHECK` do banco
garante no nível de dados).

## 7. Erros e mensagens

| Situação | Código | HTTP | Mensagem ao usuário |
|---|---|---|---|
| yt-dlp não encontrado | `ytdlp_ausente` | 503 | "O yt-dlp não está instalado ou não está no PATH. Instale com `pip install -U yt-dlp` ou defina `CONTEXTFLOW_YTDLP`." |
| Timeout | `ytdlp_timeout` | 504 | "O YouTube não respondeu em 60 s. Tente de novo." |
| Vídeo privado/removido | `video_indisponivel` | 502 | mensagem traduzida do yt-dlp |
| Falha de rede/TLS | `rede_indisponivel` | 503 | "Não foi possível alcançar o YouTube." |
| Sem legenda | — (não é erro) | 200 | estado `indisponivel` + motivo |
| Duplicado | `video_duplicado` | 409 | inalterado da F2 |

Nenhuma mensagem crua do yt-dlp vai para a tela sem tradução; o texto original
vai para o log, com a URL, sem cookies nem chaves.

## 8. Critérios de aceite da F3

| # | Critério | Como verificar |
|---|---|---|
| F3.1 | Importar vídeo com legenda manual grava título/canal/duração reais | teste de integração com dublê + teste manual real |
| F3.2 | Segmentos ordenados, `inicioMs`/`fimMs` crescentes e texto não vazio | teste de normalização + asserção no banco |
| F3.3 | Origem `manual` registrada quando existe manual | teste de integração |
| F3.4 | Sem manual, usa `auto` e registra origem `auto` | teste de integração |
| F3.5 | Sem legenda: `estado = indisponivel`, motivo preenchido, vídeo `parcial` | teste de integração |
| F3.6 | Duplicado devolve 409 sem chamar yt-dlp de novo | teste de integração |
| F3.7 | yt-dlp ausente devolve 503 com orientação, sem derrubar o servidor | teste de integração (PATH vazio) |
| F3.8 | Timeout mata o processo filho e devolve 504 | teste com dublê que dorme |
| F3.9 | Legendas sobrevivem a reinício do processo | prova de persistência |
| F3.10 | Nenhuma tag HTML, entidade crua ou bloco `NOTE` no texto gravado | teste de normalização |
| F3.11 | Nenhum arquivo temporário sobra no disco após sucesso ou falha | teste que inspeciona `tmpdir` |
| F3.12 | Interface mostra origem da legenda e permite ler os segmentos | E2E |

Além disso, os **critérios canônicos A1, A2 e A3** de
`05-criterios-de-aceite.md` passam a ser verificáveis.

## 9. Testes previstos

**Unidade**

- `normalizar-vtt.test.ts`: cabeçalho, NOTE, horário com vírgula, tags, entidades,
  bloco vazio, tempo sem horas.
- `normalizar-json3.test.ts`: eventos válidos, sem `segs`, `dDurationMs` ausente.
- `deduplicar-rolagem.test.ts`: repetição de prefixo, texto idêntico, sem repetição.
- `ytdlp-args.test.ts`: montagem de argumentos (sem shell, URL como elemento
  próprio, `--sub-format` correto).
- `traduzir-erro-ytdlp.test.ts`: mensagens conhecidas → código de domínio.

**Integração**

- `ingestao.test.ts` com `ExecutorYtdlp` falso:
  sucesso manual, sucesso auto, sem legenda, duplicado, yt-dlp ausente, timeout,
  falha de metadados, transação revertida em erro de gravação.
- Rotas novas: 200, 409, 422, 502, 503, 504.

**E2E**

- importar (com dublê injetado por variável de ambiente) → item na Biblioteca com
  canal e duração → abrir Leitura → ver segmentos com tempo.

**Manual real (quando houver rede)**

- Um vídeo com legenda manual, um só com automática, um sem legenda.
- Registrado em `docs/estado-atual.md` com data, URL e resultado.

## 10. Risco e limitação declarada

**O ambiente desta sessão não alcança o YouTube.** Verificado em 19/11: yt-dlp
2026.10.26 instalado, `--dump-single-json` falha com
`TLS/SSL connection has been closed (EOF)` — o sandbox bloqueia o domínio.

Consequência: F3 será implementada e verificada com **dublês controlados** e os
testes acima. O teste real contra o YouTube **não pode ser executado aqui** e
será:

1. registrado como **não executado** em `estado-atual.md`;
2. entregue como **roteiro de 3 comandos** para o proprietário rodar no Windows;
3. critério de homologação da F3, igual à F9.

Isso não é esconder o problema: é declarar que a F3 fica **tecnicamente
verificada** e **funcionalmente pendente de prova real** até o teste do
proprietário.

## 11. Migração

Sem migração nova: o schema da F2 já tem `transcricoes` e `segmentos` com os
campos necessários. A única adição é de **comportamento**, não de estrutura.

Se durante a implementação for necessário um campo, entra como **migração 002**
com `reverterPara` escrito e testado, seguindo o padrão da F2.

## 12. Precedência documental

`01-escopo-canonico.md` > `03-arquitetura-e-contratos.md` > este documento >
`04-plano-mestre.md`. Em conflito, vale o canônico e o conflito é registrado aqui.

## 13. Definição de concluído

- Todos os critérios F3.1–F3.12 verificados com evidência executada.
- Suíte antiga continua verde (62/62 → somados os novos).
- `docs/estado-atual.md` atualizado com commit, evidências e o que **não** foi
  verificado.
- Roteiro de teste real do YouTube escrito para o proprietário.
- Commit próprio da F3.
