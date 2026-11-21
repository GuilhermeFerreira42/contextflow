# ContextFlow V1

Biblioteca pessoal **local** de vídeos do YouTube: metadados, transcrições com
timestamps, resumos por IA e leitura em planilha de alta densidade.

Aplicativo local para **Windows e Linux** — motor em Node.js + TypeScript com interface
web própria. Monólito modular. Chat sobre conteúdo é V2.

> **Estado:** F1–F5 implementadas; reformulação F5-UI implementada, com
> homologação humana pendente. Última regressão local: 177 testes aprovados,
> 6 ignorados no Windows e 57/57 cenários E2E. F6 somente especificada;
> não iniciar nesta etapa. Estado e limites vigentes em
> [`docs/estado-atual.md`](docs/estado-atual.md).

## Como rodar

```bash
cd platform
npm install
npm run dev        # http://127.0.0.1:4780
```

Abre no navegador: Biblioteca, Importações e Configurações. A leitura fica
integrada à Biblioteca, com resumo na linha e painel sobreposto.

### Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento (TypeScript direto, sem build) |
| `npm start` | executa a partir do build (`npm run build` antes) |
| `npm run build` | typecheck + compila para `dist/` |
| `npm test` | unidade + integração; resultados por ambiente no estado atual |
| `npm run test:e2e` | interface em navegador real (precisa de Chrome — ver abaixo) |
| `npm run verificar` | fumaça: sobe, confere endpoints e estáticos, derruba |

### E2E (navegador real)

O teste E2E usa Chrome/Chromium/Edge via CDP, com descoberta automática nos
caminhos conhecidos. Se necessário, aponte o binário no Linux:

```bash
CHROME_BIN=/caminho/para/chrome npm run test:e2e
```

No PowerShell, a configuração equivalente é:

```powershell
$env:CHROME_BIN = 'C:\caminho\para\chrome.exe'
npm run test:e2e
```

## Estrutura

```
contextflow2/
├── docs/       documentação canônica: escopo, arquitetura, plano, SPECs, estado
└── platform/   todo o projeto executável (motor + interface + testes + scripts)
```

Detalhes de organização e as regras do projeto em
[`docs/00-comece-aqui.md`](docs/00-comece-aqui.md) e
[`docs/07-protocolo-continuidade.md`](docs/07-protocolo-continuidade.md).

## Dados

Banco e artefatos ficam fora do Git, em pasta por sistema operacional
(`%APPDATA%\ContextFlow` no Windows, `~/.local/share/ContextFlow` no Linux),
sobrescrevível por `CONTEXTFLOW_DADOS`.
