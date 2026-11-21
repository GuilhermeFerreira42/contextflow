# Skills usadas na revisão de interface

Registro de como as duas skills pedidas foram usadas nesta rodada, o que
funcionou de fato e o que não pôde ser executado. Serve para a próxima sessão
não repetir a descoberta.

## Frontend Design (`anthropics/skills`)

- **Como foi obtida:** clone raso de `github.com/anthropics/skills`, pasta
  `skills/frontend-design/`. É um `SKILL.md` — instruções, não código.
- **O que foi aplicado:** os princípios de crítica e acabamento. Em concreto:
  remover caixa alta com tracking dos cabeçalhos de seção do painel de
  leitura (o mockup só a define para as colunas da tabela e "Organizar por",
  que foram preservados); diferenciar "Não definido" de valor configurado;
  transformar o vazio da fila em convite à ação; densidade de linha derivada
  da altura declarada, não um número solto.
- **O que foi deliberadamente NÃO aplicado:** a skill propõe uma direção
  visual autoral (tipografia própria, cor de destaque distinta, layout
  "não-templated"). O pedido foi explícito: **refinar o que existe**, não
  redesenhar. As decisões de produto já aprovadas — paleta `#080b12`, azul
  de destaque, tabela de alta densidade, colunas em caixa alta — foram
  mantidas. Seguir a skill ao pé da letra teria contrariado o briefing.
- **Limitação:** a skill não tem scripts nem verificador automático; ela
  orienta julgamento humano e leitura de código.

## Agent Browser (`vercel-labs/agent-browser`)

- **Como foi obtida:** `npm install -g agent-browser` (0.43.0). Instalou.
- **Limitação encontrada:** `agent-browser install` tenta baixar o Chrome
  for Testing de `googlechromelabs.github.io`, que **não é alcançável** neste
  ambiente (a rede libera GitHub, npm, PyPI). O download falha com erro de
  TLS.
- **Contorno usado:** a CLI aceita `--cdp`. Apontei para o Chrome do sandbox
  já disponível em `~/.cache/cdp/chrome-bin`:

  ```bash
  agent-browser --cdp http://127.0.0.1:9500 --session cf open http://localhost:4780
  ```

  Com isso, **a Agent Browser foi realmente usada** — `snapshot -i`, `click`,
  `eval`, `screenshot`, `set viewport`, `find role` — e não substituída por
  scripts caseiros de CDP. O Chrome que ela controlou é o mesmo que os testes
  E2E usam.
- **Skills carregadas da própria CLI:** `agent-browser skills list` e
  `agent-browser skills get dogfood` — esta última define o método seguido
  (inicializar sessão, orientar-se, explorar, documentar achado por achado,
  recapturar depois de corrigir).

## O que NÃO foi usado

- Nenhuma das duas skills foi instalada como "plugin" no meu ambiente — não
  há mecanismo para isso aqui. Elas foram lidas e seguidas como procedimento.
- Não foi possível usar o Chrome for Testing baixado pela Agent Browser
  (bloqueio de rede). Todas as capturas e medições vieram do Chrome do
  sandbox, controlado pela Agent Browser via CDP.
