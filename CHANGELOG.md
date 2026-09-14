# Histórico

## 0.4 — edição estilo Canva, ilustrações e capas com nome
- **Editar direto na folha em qualquer página**: tocar seleciona, arrastar move,
  alças mudam o tamanho, tocar de novo digita ali mesmo. Barra de ícones (fonte,
  tamanho, cor, negrito, centralizar, duplicar, trocar, excluir) no rodapé do
  celular e no topo da prancheta no computador.
- **Catálogo de ilustrações** (~400, com busca): enfeites e molduras, flores,
  animais, comidas, festas, carinhas e ícones de traço recoloríveis — vetoriais
  no PDF. Textos, imagens e ilustrações em qualquer seção do miolo.
- **Capas com nome personalizado** (8 estilos) e **marca d'água** opcional
  (texto, ilustração ou imagem; centro, canto ou repetida).
- **Páginas repetidas agrupadas** na prévia (uma miniatura "×60 páginas").
- **Passo a passo** com filtro de capas e "toques finais".
- Celular: sem acrílico por padrão, botão + mais baixo, controles revisados.

## 0.3 — interface redesenhada e impressão com prévia
- **Interface nova**: etapas Modelo → Personalizar → Imprimir na barra, painel
  esquerdo em abas (Páginas, Papel, Datas, Estilo, Modelos), barra flutuante de
  navegação e zoom, galeria inicial com miniaturas reais e filtros.
- **Imprimir e baixar**: prévia real da folha (mesma imposição do PDF), modos em
  cartões, resumo de folhas, instruções para a impressora e verificação antes
  de imprimir.
- **Capas**: 5 estilos novos (moderna, cor sólida, metade colorida, ano em
  destaque, arco); cada modelo com capa e paleta próprias.
- **PDF**: imagens JPEG embutidas direto (arquivos bem menores) e logo sem
  distorção; nomes de feriado não invadem mais a célula vizinha.

## 0.2 — núcleo compartilhado, editor de blocos e assistente de início
- **Página personalizada**: novo editor de blocos de tela cheia — 13 tipos
  (texto, título, linhas, pontilhado, quadriculado, caixa, tabela, checklist,
  grade de horários, mini calendário, círculos de hábito, imagem, divisor),
  grade com encaixe em mm, redimensionamento, "Meus modelos" salvos no
  navegador.
- **Datas especiais**: feriados nacionais (inclusive móveis), estaduais por
  UF, pontos facultativos, datas comemorativas e eventos próprios — aparecem
  no mês, na semana, no dia e via variáveis `{feriado}`/`{evento}` nos blocos.
- **Estimativa de acabamento**: gramatura e tipo de papel calculam a
  espessura do miolo e sugerem anel wire-o ou espiral.
- **Editor de imagem embutido** no fundo da capa (arrastar, zoom, rotação,
  espelhar, filtros com presets "Básico"/"Clássico"), com "Reenquadrar" para
  reabrir o mesmo ajuste depois.
- **Assistente de início rápido** (tela de onboarding) para quem está
  começando um documento do zero.
- Limite de páginas por seção subiu de 600 para 2000 — cabe uma agenda diária
  completa de 2 páginas por dia.
- Exportação ganhou um modo automático que decide entre tamanho real e ajuste
  a A4 com marcas de corte, conforme o papel escolhido.
- Internamente, datas/feriados, o construtor de blocos, a estimativa de
  acabamento e o editor de imagem passaram a vir de um núcleo compartilhado
  (`vendor/core/`), usado também pelas outras ferramentas da Esmeralda Paper.

## 0.1 — primeira versão
- Geração de miolo de cadernos/planners/agendas: capa, divisórias de seção,
  índice, ano, metas, páginas de mês/semana/dia a partir de modelos prontos.
- Variáveis dinâmicas de data e texto (`{dia}`, `{mes}`, `{ano}`…).
- Exportação em PDF vetorial, PNG e impressão direta.
- Guia do usuário ilustrado, instalável como PWA.
