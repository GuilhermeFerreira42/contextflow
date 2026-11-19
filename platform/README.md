# platform/ — projeto executável

Tudo o que é necessário para **desenvolver, testar, construir e executar** o ContextFlow V1
vive aqui. A documentação canônica fica em `../docs/`.

## Requisitos

- **Node.js ≥ 22.5** — usa `--experimental-strip-types` (TypeScript direto em dev/testes) e
  **`node:sqlite`** (banco nativo). Sem etapa de build obrigatória para rodar em dev.
  Os scripts passam `--experimental-sqlite`, necessário no Node 22 anterior ao 22.13.
  A versão mínima é exigida porque `node:sqlite` só existe a partir daí.

> **Zero dependências de produção.** O banco é o `node:sqlite` embutido no Node, escolhido
> justamente para que `npm install` não precise de toolchain C++ nem compilar nada — nem no
> Windows, nem atrás de proxy. Instalação medida: **0,38 s**.
- **npm ≥ 10** (workspaces).
- Linux ou Windows.

## Comandos

```bash
npm install            # instala dependências (6 pacotes, sem compilação)
npm run dev            # desenvolvimento: roda o TypeScript direto
npm start              # produção: roda dist/ (exige npm run build antes)
npm run build          # typecheck + gera dist/
npm run typecheck      # só checagem de tipos
npm test               # unidade + integração (node:test) — 122 testes
npm run test:e2e       # UI em navegador real via CDP — 17 cenários
npm run verificar      # fumaça: sobe o motor, checa endpoints, derruba
```

**Primeira execução, do zero:**

```bash
npm install && npm test && npm run verificar
```

Se os três passarem, o ambiente está bom. Depois `npm run dev` e abra
<http://127.0.0.1:4780>.

### Testes E2E e o navegador

O E2E usa o Chrome/Chromium/Edge **já instalado na máquina**, via protocolo de
depuração (CDP). Ele procura sozinho em caminhos conhecidos de Windows, Linux e
macOS. Se não encontrar, aponte manualmente:

```powershell
$env:CHROME_BIN = "C:\Program Files\Google\Chrome\Application\chrome.exe"
```

```bash
export CHROME_BIN=/usr/bin/google-chrome
```

**6 testes são pulados no Windows** (os que criam binário falso baseado em
shell). Ver `# skipped 6` na saída é o comportamento esperado.

## Estrutura

```
src/
├── compartilhado/   # tipos e contratos — usado por motor e interface
├── motor/           # API HTTP + regras de negócio (Node.js)
│   ├── nucleo/      # bootstrap, config, logging, erros
│   ├── modulos/     # biblioteca, ingestao, trabalhos, resumos, configuracao
│   ├── persistencia/
│   └── integracoes/ # yt-dlp, provedores de IA
├── interface/       # frontend web local servido pelo motor
scripts/             # dev, build, start, verificação
testes/              # unidade, integração, E2E
```

## Ingestão: o yt-dlp precisa estar instalado

A importação de vídeos usa o **yt-dlp** como processo externo. Ele não é
dependência do npm — é binário do sistema:

```powershell
winget install yt-dlp          # Windows
```

```bash
pip install -U yt-dlp          # Linux/macOS
```

Se não estiver no PATH, aponte com `CONTEXTFLOW_YTDLP`. A tela **Importações**
mostra um diagnóstico em tempo real dizendo se foi encontrado e qual a versão.
Sem ele, a importação falha explicando o que instalar — o resto do app continua
funcionando.

## Dados

O banco e os artefatos ficam em uma pasta de dados **fora do Git**, configurável por
variável de ambiente e com padrão por sistema operacional:

| SO | Pasta padrão |
|---|---|
| Windows | `%APPDATA%\ContextFlow` |
| Linux | `~/.local/share/ContextFlow` |

## Variáveis de ambiente

| Variável | Padrão | Para quê |
|---|---|---|
| `CONTEXTFLOW_PORTA` | `4780` | porta HTTP |
| `CONTEXTFLOW_HOST` | `127.0.0.1` | endereço de bind (local por padrão) |
| `CONTEXTFLOW_DADOS` | pasta do SO acima | onde ficam banco e artefatos |
| `CONTEXTFLOW_YTDLP` | `yt-dlp` (PATH) | caminho do binário do yt-dlp |
| `CONTEXTFLOW_YTDLP_TIMEOUT` | `60000` | tempo máximo por operação (ms) |
| `CONTEXTFLOW_IDIOMAS` | `pt-BR,pt,en` | ordem de preferência das legendas |
| `CONTEXTFLOW_AMBIENTE` | `desenvolvimento` | `desenvolvimento`, `teste` ou `producao` |

Ver `../docs/specs/` para o contrato de cada fatia e
`../docs/estado-atual.md` para o que já está pronto.
