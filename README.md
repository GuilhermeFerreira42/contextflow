# ContextFlow V1

Biblioteca pessoal **local** de vídeos do YouTube: metadados, transcrições com
timestamps, resumos por IA e leitura em planilha de alta densidade.

Aplicativo local para **Windows e Linux** — motor em Node.js + TypeScript com interface
web própria. Monólito modular. Chat sobre conteúdo é V2.

> **Estado:** F1–F6 e ajustes pós-F6 implementados. Correção da miniatura no
> Windows: 226 testes aprovados, seis ignorados; 57/57 CDP e Playwright:
> 4/4 miniatura, 13/13 pós-F6, 9/9 refinamentos e 7/7 F6. IA nesta rodada
> usou provedor HTTP controlado; nova geração real não executada.
> Homologação humana da correção pendente. Estado e limites em
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
| `npm run test:e2e:refinamentos` | Playwright: lateral, arraste de colunas/altura e leitura com 5.000 vídeos descartáveis |
| `npm run test:e2e:miniatura` | Playwright: crescimento da miniatura, título abaixo, slider/arraste reais, limites da coluna e reload |
| `npm run test:e2e:pos-f6` | Playwright: oito ajustes de interface e fluxos pós-F6 |
| `npm run test:e2e:resumos` | Playwright F6: configuração, estimativa, geração/fila, cancelamento/retry, leitura/cópia/histórico; provedor HTTP controlado |
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
