# Certificados SOBEF

Aplicativo estático em português para acompanhar turmas, processos de produção e entrega de certificados do programa Jovem Aprendiz. Preparado para GitHub Pages, sem servidor e sem envio das bases a uma API.

## Uso

- Abra o site e clique em Importar planilha. Selecione seu Excel ou CSV, confira a aba, o ano sugerido e a prévia.
- Use Nova turma para cadastrar, e Turmas para buscar, combinar filtros, ordenar, editar, excluir e exportar.
- O Calendário mostra as datas de término das turmas do ano de referência selecionado.
- Salvar backup baixa um JSON com a base completa, processos e histórico. Para recuperar, abra Arquivos e ajuda → Abrir backup JSON.
- Conectar arquivo usa a File System Access API quando disponível em contexto seguro. Abra um JSON existente ou crie um arquivo da sessão; alterações posteriores são escritas no arquivo escolhido. É necessário reconectar o arquivo a cada nova sessão.

## Persistência e privacidade

Os registros ficam na memória da aba, não no armazenamento do navegador. Sem arquivo conectado, é necessário baixar um backup antes de fechar ou atualizar; o navegador pode exibir um aviso de alterações pendentes, mas esse aviso não substitui o backup.

O arquivo conectado e seus dados permanecem no dispositivo. A conexão depende de suporte do navegador, permissão e contexto de execução; na prévia incorporada, no Firefox ou no Safari, pode não estar disponível. Nesse caso, utilize download/restauração de JSON. A interface avisa se uma gravação falhar.

Esta versão não tem login nem base compartilhada entre usuários. A publicação do aplicativo não publica as planilhas importadas. Não adicione planilhas, backups ou dados pessoais ao repositório. O `.gitignore` reduz o risco de inclusão acidental, mas não substitui revisão.

## Compatibilidade com a planilha original

- Nome da aba orienta o ano de referência, não o nome do arquivo.
- Cabeçalhos com acentos e espaços são reconhecidos.
- Colunas de etapas e colunas de quantitativos são distintas.
- Processos preservam OK, PULADO e NÃO TEM; vazios continuam pendentes.
- TABULADO é mapeado para EM ANDAMENTO, preservando o texto original nas observações. Outros estados desconhecidos tornam-se PENDENTE e são anotados.
- Datas de Excel são lidas como datas, evitando a ambiguidade de strings de dia e mês.
- Quantitativos vazios não são convertidos para zero.
- Duplicatas são identificadas por ano, número, município, curso e início, com normalização de espaços externos, caixa e acentos. Uma duplicata é ignorada, não atualiza o registro anterior.
- Excel e CSV exportam o filtro atual de Turmas, incluindo todas as páginas. O resumo do Excel usa a mesma população.
- JSON é o formato de backup integral. Excel/CSV não preservam histórico.
- Backups antigos com `records` ou um array de registros são aceitos. Processos booleanos `true` viram OK.

## Publicação no GitHub Pages

O workflow `.github/workflows/pages.yml` publica somente a pasta `site` ao receber um push na branch `main`. A configuração Pages do repositório deve usar GitHub Actions.

O repositório e a visibilidade devem ser escolhidos conscientemente. O aplicativo não inclui a planilha original nem dados de demonstração que possam ser confundidos com a base real.

## Executar localmente

Abra `site/index.html` no navegador ou sirva a pasta `site` com um servidor estático. Fonte, ícones e biblioteca Excel estão incluídos localmente. Não existe instalação PWA nem cache offline automático do endereço público.

## Dependências

- SheetJS CE 0.20.3, Apache-2.0: https://cdn.sheetjs.com/xlsx-0.20.3/package/
- Lucide 0.468.0, ISC: https://github.com/lucide-icons/lucide
- General Sans, Fontshare / ITF Free Font License: https://www.fontshare.com/fonts/general-sans

Os arquivos distribuídos mantêm os avisos presentes nas bibliotecas. Nenhuma chave, credencial ou banco de dados é necessário para executar este aplicativo.
