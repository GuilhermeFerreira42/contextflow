# Plano mestre — V1

**Natureza:** mapa de entregas. A numeração é sugestiva e **não corresponde a progresso
executado**. Cada fatia tem SPEC própria escrita/fechada **antes** da execução; requisitos
globais permanecem nos documentos canônicos.

| Etapa | Resultado observável | Dependências / Gate |
|---|---|---|
| **E0 — Investigação** | decisão registrada de migração/reuso, riscos, base e versões | ✅ concluída em nível suficiente (ver `02`) |
| **F1 — Esqueleto modular** | motor Node+TS sobe localmente, serve a interface, contratos e scripts reproduzíveis | ✅ concluída + homologada |
| **F2 — Persistência e migração** | biblioteca persiste vídeo e conteúdo; migrações versionadas | ✅ concluída + **homologada** (banco decidido por medição) |
| **F3 — Ingestão/legendas** | metadados reais, legendas manual/auto segmentadas por tempo | 🟨 **validada no Windows/YouTube real** (`c6b7db5`); aceite humano pendente, ressalvas no estado atual. **Playlist ficou para a F4.** |
| **F4 — Trabalhos e recuperação** | fila persistente, estados, cancelamento, falhas, reexecução controlada | ✅ concluída + testada (`5a13b3c`) |
| **F5 — Biblioteca** | grid virtualizado, filtros/pesquisa, seleção, ações em lote | ✅ concluída + testada (`7b58f32`) |
| **F5-UI — Reformulação da interface** | Biblioteca centrada, linhas com resumo, colunas, painel sobreposto, árvore lateral, Adicionar link | 🟨 **implementada e testada** (`9e7ce02`, `3db2e48`); homologação humana pendente. SPEC em `specs/f5-ui-reformulacao.md` |
| **F6 — IA para resumos** | provedores/configuração, resumos persistidos, custos/erros, múltiplas seleções | **SPEC escrita** (`d9ef6a6`), **não implementada**. É a próxima fatia autorizada |
| **F7 — Leitura avançada** | resumos/transcrições/ambos, expansão, leitor completo, retorno sem perda de estado | F5–6; textos longos. **Nota:** a leitura na linha e o painel sobreposto já existem desde a F5-UI; a F7 acrescenta o que falta (ver SPEC) |
| **F8 — Configuração e acabamento** | preferências, segurança, navegação, feedback consistente, texto de ajuda | F1–7; exportação só se aprovada na SPEC |
| **F9 — End-to-end e entrega** | smoke, regressão, instalação Windows/Linux, roteiro de homologação V1 | todas; aceite do escopo |

## Regras por fatia

1. Escrever **SPEC pequena**: escopo, interfaces, erros, critérios, testes, migração/
   reversão, precedência documental.
2. Executar, validar com evidência, corrigir falhas novas, **commit próprio**.
3. Atualizar `docs/estado-atual.md` com commit, arquivos, resultados e próximo passo.
4. Avançar autonomamente **somente** dentro da autorização vigente.

## Sequência prática recomendada

`F1 → F2 → F3 → F4 → F5 → F6 → F7 → F8 → F9`, cada uma com sua SPEC.
F2 e F3 podem ser preparadas em paralelo documental, mas F3 só roda sobre persistência real.

### Ajuste de escopo registrado na F3

O plano original listava "URL/vídeo/**playlist**" na F3. A implementação entregou
**apenas vídeo unitário**: playlist exige fila, progresso por item e retomada —
que são exatamente o escopo da F4. Importar playlist sem fila seria um laço
bloqueante na requisição HTTP, o oposto do que o escopo canônico pede
("não bloquear a UI"). Portanto **playlist vai junto da F4**, e isso não é
redução de escopo, é sequenciamento.

## Definição de concluído da V1

Todas as exigências V1 com evidências end-to-end; instalações verificadas em Windows e
Linux **ou limitação declarada**; nenhum defeito crítico conhecido impedindo uso;
migração protegida; documentação de uso/execução; **aceite humano explícito**.
Chat da V2 não condiciona o aceite da V1.

## Limitações históricas do ambiente de desenvolvimento original

O registro abaixo descreve o ambiente anterior. A retomada de 19/11/2026 foi
executada no Windows com YouTube real; resultados e ressalvas em `estado-atual.md`.

- O ambiente desta sessão é **Linux**. A verificação em **Windows** não pode ser executada
  aqui: ela será registrada como **não executada**, com roteiro de verificação, até que
  exista máquina Windows disponível. Isso **não** bloqueia F1–F8, mas é pré-condição da F9
  e deve ser declarado ao proprietário, não escondido.
- yt-dlp depende de rede externa; a F3 terá testes que exercitam o adaptador com respostas
  controladas e um teste manual real (vídeo disponível/indisponível) quando houver rede.
