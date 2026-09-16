# Planner Studio

Gera o miolo de cadernos, planners e agendas personalizados, pronto para
impressão — **PDF**, **PNG** ou impressão direta. Modelos prontos (capa,
divisórias, mês, semana, dia), variáveis dinâmicas de data, feriados e datas
comemorativas do Brasil, e um editor de blocos para montar páginas do seu
próprio jeito.

Roda inteira no navegador: sem instalação, sem back-end e **sem enviar nada**.
O documento fica só no navegador (`localStorage`) e **Meus projetos** guarda
cópias completas ali mesmo, com miniatura; para backup ou para levar a outro
computador, baixe o **arquivo do projeto** (`.json`).

## O que faz

- Documento com capa, divisórias de seção, índice, ano, metas e páginas de
  calendário/agenda (mensal, semanal, diário), a partir de modelos prontos.
- **Edição direta na folha**: clicar seleciona o texto, o logo ou uma
  ilustração; arrastar move; clicar de novo escreve. Fonte, cor, contorno,
  fundo atrás do texto, sombra, giro, transparência e camadas — vetorial no PDF.
- **Fundo das páginas** (cor, degradê, estampas ou foto) e **marca d'água** em
  sete estilos, para o documento todo ou só para uma seção.
- **Página personalizada**: editor de blocos de tela cheia (texto, título,
  linhas, pontilhado, quadriculado, caixa, tabela, checklist, grade de
  horários, mini calendário, círculos de hábito, imagem, divisor), com grade
  em mm, redimensionamento e "Meus modelos" salvos no navegador.
- Variáveis dinâmicas no texto: `{dia}`, `{mes}`, `{ano}`, `{semana_numero}`,
  `{dias_restantes}`, `{feriado}`, `{evento}`, `{secao}`, `{nome_dono}`,
  `{campo:chave}`.
- **Datas especiais**: feriados nacionais (inclusive móveis, calculados por
  algoritmo de Páscoa), estaduais por UF, pontos facultativos, datas
  comemorativas e uma lista de eventos próprios.
- **Estimativa de acabamento**: a partir da gramatura e do tipo de papel,
  calcula a espessura do miolo e sugere anel wire-o ou espiral.
- Editor de imagem embutido no fundo da capa (arrastar, zoom, rotação,
  espelhar, filtros com presets "Básico"/"Clássico").
- Exportação: PDF vetorial (tamanho real, ajustado a A4 com marcas de corte,
  2 por folha ou livreto), PNG da página atual, impressão direta.
- Assistente de início rápido e um guia do usuário ilustrado em `guia.html`.

## Estrutura

```
index.html          marcação da interface
guia.html            guia do usuário (página à parte)
css/
  base layout studio mobile print util   estilo geral
  editor.css                              editor de blocos ("Página personalizada")
  guia.css                                estilo do guia
js/
  config.js           tipos de página, defaults, constantes
  engine.js            estado do documento, migração de projeto, cálculo de página
  editor.js             editor de blocos de tela cheia
  wizard.js              assistente de início rápido
  ui.js                   painéis, eventos de interface
  io.js                    exportação (PDF/PNG/impressão), salvar/carregar projeto
  pages.js                  desenho de cada tipo de página pronta
  pen.js                     "caneta" única: mesmo desenho na tela (SVG) e no PDF
  fonts.js, mobile.js, install.js
vendor/core/         núcleo compartilhado (datas/feriados, blocos, acabamento,
                     editor de imagem) — cópia estática, não gerada por build
assets/              fontes (woff2) e ícones
manifest.webmanifest PWA (instalar na tela de início)
.htaccess            blindagem da pasta (Apache / LiteSpeed)
```

Sem build, sem dependências. Abra `index.html` no navegador — funciona
inclusive por `file://` (mantenha `css/`, `js/`, `vendor/` e `assets/` ao
lado).

## Rodar local

```
python3 -m http.server 8000
# http://localhost:8000/
```

Servir por HTTP é útil para testar com a CSP vindo como cabeçalho (o
`.htaccess`), não só pela tag `<meta>`.

## Projeto salvo

Formato `.esmeralda-planner.json`, guardado no `localStorage` do navegador;
projetos antigos continuam abrindo (o `engine.js` trata a migração).

## Documentação

- `CHANGELOG.md` — histórico de versões

## Autor

Carlos Avelino Correa — <https://github.com/avelinocarloscorrea>

Código-fonte deste repositório: <https://github.com/avelinocarloscorrea/planner>
— código aberto sob licença MIT.

## Licença

[MIT](LICENSE).
