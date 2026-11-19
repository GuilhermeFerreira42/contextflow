# Roteiro de teste real da F3 (YouTube)

> Para o proprietário executar no **Windows**. Leva cerca de 5 minutos.
> O ambiente onde a F3 foi codificada **não alcança o YouTube**, então esta é a
> única prova que falta. Sem ela, a F3 está tecnicamente verificada, mas não
> funcionalmente homologada.

## 1. Instalar o yt-dlp (uma vez só)

Abra o **PowerShell** e rode:

```powershell
winget install yt-dlp
```

Se `winget` não existir ou falhar:

```powershell
python -m pip install -U yt-dlp
```

Confirme que funcionou:

```powershell
yt-dlp --version
```

Deve aparecer algo como `2026.10.26`. Se der "não reconhecido", feche e abra o
PowerShell de novo (o PATH só é atualizado em sessões novas).

## 2. Subir o app

```powershell
cd C:\Users\Usuario\Desktop\contextflow2\platform
npm run dev
```

Abra **http://127.0.0.1:4780** e clique em **Importações**.

O bloco de diagnóstico deve mostrar **verde**, algo como:

> Ingestão — yt-dlp 2026.xx.xx pronto

Se mostrar **vermelho**, o binário não está no PATH. Nesse caso, informe o
caminho explicitamente:

```powershell
$env:CONTEXTFLOW_YTDLP = "C:\caminho\para\yt-dlp.exe"
npm run dev
```

## 3. Os três testes que importam

### Teste A — vídeo com legenda manual (critério A1)

1. Cole uma URL de um vídeo com legenda manual em português.
2. Clique em **Importar vídeo**.
3. Espere (pode levar de 3 a 20 segundos).

**Deve aparecer:** `Importado — <título real> · N trechos · legenda manual (pt).`

**Conferir na Biblioteca:**
- título real (não "Vídeo xxxxx")
- canal preenchido
- duração no formato `m:ss`
- estado **Pronto**

**Conferir na Leitura:**
- a linha aparece com canal, "legenda manual" e quantidade de trechos
- ao clicar, os trechos abrem com o tempo à esquerda (`0:00`, `0:12`, …)
- clicar no tempo abre o YouTube naquele momento

### Teste B — vídeo só com legenda automática (critério A2)

Repita com um vídeo que **não** tenha legenda manual (canais menores costumam
só ter automática).

**Deve aparecer:** `legenda automática` em vez de `legenda manual`.

Vale olhar o texto na Leitura: as legendas automáticas têm repetição de rolagem;
o normalizador remove isso. O texto deve ler normalmente, sem frases duplicadas
em sequência.

### Teste C — vídeo sem legenda (critério A3)

Use um vídeo que não tenha legenda nenhuma (vídeo musical antigo, por exemplo).

**Deve aparecer:** o título real e a mensagem
`<título> — Este vídeo não tem legenda, nem manual nem automática.`

Na Biblioteca, o estado deve ser **Parcial**, e **não** "Pronto".
Isso é o comportamento correto: metadados vieram, transcrição não.

## 4. Prova de persistência

1. Feche o app com **Ctrl+C**.
2. Suba de novo com `npm run dev`.
3. Abra a Biblioteca e a Leitura.

Tudo deve continuar lá — títulos, canais, duração e **os trechos com tempo**.

## 5. Prova de deduplicação

Importe a mesma URL do Teste A outra vez.

**Deve aparecer:** `Já está na biblioteca — <título> …`

E a Biblioteca continua com o mesmo número de vídeos.

## 6. Testes de falha (rápidos)

**URL de outro site:** cole `https://vimeo.com/123` e importe.
Deve dizer `Domínio não suportado: use URLs do YouTube`.

**Vídeo privado:** importe uma URL de vídeo privado de que você tenha o link.
Deve dizer `Este vídeo é privado.` — e não um monte de texto técnico.

**yt-dlp quebrado no PATH:** rode
`$env:CONTEXTFLOW_YTDLP = "C:\nao\existe\yt-dlp.exe"` e importe.
Deve dizer que o yt-dlp não está instalado, com a sugestão do `pip install`.

## 7. O que fazer com o resultado

Me diga, para cada teste:

- **passou** ou **não passou**
- o que apareceu na tela (pode ser o texto)
- a URL usada (se for pública)

Se algo falhar, o log do terminal ajuda muito: ele mostra o stderr do yt-dlp,
que é onde está a causa real (vídeo removido, pedido de login, mudança no
YouTube).

## Por que este roteiro existe

A F3 tem 122 testes automatizados, 17 cenários de navegador real e prova de
processo (timeout, binário ausente, injeção de comando). Nenhum deles usa o
YouTube de verdade — porque o ambiente de desenvolvimento desta sessão tem o
domínio bloqueado.

Isso é declarado, não escondido. O yt-dlp muda com frequência; um teste real
hoje vale mais que dez simulações.
