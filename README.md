# SRT Maker

App local para gerar SRT com `whisper-cli`.

## Como abrir

```bash
npm run dev
```

Ou, depois de um build:

```bash
npm run build
npm run electron
```

## Defaults

- Modelo: `ggml-small.bin`, quando encontrado em `~/.rapid-edit/models`
- Idioma: `pt`
- Máximo por bloco: `32` caracteres
- Mínimo por bloco: `0.6s`
- Prompt técnico: `Redis, cache, PostgreSQL, API, request, hit, miss, banco relacional, memória RAM`
- Remove silêncio/música final detectado

## Fluxo

1. Escolha ou arraste o áudio.
2. Confirme o modelo.
3. Escolha onde salvar o SRT.
4. Ajuste caracteres, tempo e prompt se precisar.
5. Clique em `Gerar SRT`.
