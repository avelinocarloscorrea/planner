# Histórico

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
