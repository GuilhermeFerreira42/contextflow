# Continuidade de projeto e governança de documentação

**Fonte canônica**: `docs/01-escopo-canonico.md` + decisões autorizadas.
**Estado operacional**: `docs/estado-atual.md`. **Evidências**: arquivo/teste/commit
referenciados no estado. Logs volumosos e artefatos grandes ficam **fora do Git**
(pasta `Continuidade de Projeto`, irmã do repositório). **Nunca** criar múltiplos status contraditórios.

## Onde guardar cada coisa

| Conteúdo | Onde | Versionado? |
|---|---|---|
| Escopo, decisões, plano, critérios | `docs/` | **sim** |
| Estado de retomada (branch, HEAD, feito, próximo) | `docs/estado-atual.md` | **sim** |
| SPEC de cada fatia | `docs/specs/` | **sim** |
| Código, testes, scripts, configs | `platform/` | **sim** |
| Capturas, vídeos, logs extensos, saídas brutas, cópias de recuperação | `Continuidade de Projeto/` | **não** |
| Segredos, tokens, bancos pessoais, credenciais | fora de tudo; nunca em nota/commit | **nunca** |

Toda evidência externa citada no estado deve dizer **nome do artefato, o que demonstra,
revisão correspondente e como encontrá-lo** — o resumo versionado precisa continuar
compreensível se o artefato desaparecer.

## Fluxo de uma sessão nova

**Papéis vigentes, definidos pelo proprietário em 21/11/2026:** Codex é parceiro
de raciocínio e pode executar o escopo explicitamente autorizado. Depois de
trazer a entrega atualizada da Arena, o proprietário autorizou o Codex a corrigir
os refinamentos de grade/leitura/lateral, registrados no estado e na SPEC própria.
Uma tarefa repassada apenas como contexto não autoriza repetir implementação.
Registrar separadamente
o relato de entrega da Arena, a presença da revisão local e a evidência executada.
Atualização de 22/11/2026: o proprietário pediu comitar as dimensões e avançar à
próxima fatia. F6 autorizada, especificada e implementada; provas e limitações no
estado atual. A proibição anterior de iniciar F6 foi superada por esse pedido.
F7/F8 continuam sem implementação nesta rodada.

1. `docs/00-comece-aqui.md` → escopo → decisões → `docs/estado-atual.md`.
2. No repositório: conferir branch/HEAD e alterações locais; **não** sobrescrever
   alterações de terceiros.
3. Identificar última fase tecnicamente concluída, homologação pendente, bloqueios e
   próxima etapa autorizada.
4. Ler apenas as SPECs e o código relevantes; confirmar compatibilidade dos contratos.
5. Executar a fatia, testar (inclusive regressões), corrigir e documentar comprovação.
6. Registrar em `docs/estado-atual.md`: commit/branch, arquivos, resultados, pendências e
   próximo passo.

## Regras de documentação

- Proposta **não é** decisão; código existente **não prova** aprovação nem comportamento.
- Divergência entre código e documentação é **incidente a analisar**, não justificativa
  para adulterar a referência aprovada.
- Não editar escopo canônico sem aprovação do proprietário. Não redefinir arquitetura
  fundamental unilateralmente.
- **Homologação técnica e aceite humano nunca se confundem.**
- Credenciais e dados privados ficam fora do repositório e dos materiais entregues.

## Estrutura física do projeto

```
contextflow/              → projeto original (Python). Somente leitura.
contextflow2/             → repositório Git deste projeto
├── docs/                 → documentação canônica
└── platform/             → tudo do executável Node.js + TypeScript
Continuidade de Projeto/  → material operacional, FORA do Git (ao lado do repositório)
```
