# ColdAlert (protótipo)

Abra a pasta `coldalert` no VS Code (Arquivo > Abrir Pasta).

Para ver no navegador: instale a extensão **Live Server**, clique com o botão direito em `index.html` > *Open with Live Server*. Também funciona com duplo clique em `index.html`. Sem build, sem npm.

## Estrutura
- `index.html`: casca da página (tela inicial com o globo e o aplicativo).
- `css/styles.css`: estilos e variáveis de cor.
- `js/data.js`: cenário simulado, índice de risco, alertas, abrigos, ocorrências, contexto municipal (fatos datados com fonte).
- `js/charts.js`: gráficos em SVG.
- `js/gis.js`: mapa (grade hexagonal, camadas, importação de GeoJSON).
- `js/ui.js`: componentes (selos de procedência, modais, avisos).
- `js/globe.js`: globo (sem continentes: não há fonte cartográfica embutida).
- `js/views1.js` e `js/views2.js`: os 15 módulos.
- `js/main.js`: navegação, barra superior e tela inicial.

## Dados
Só o contexto histórico (DGABC, 02/06/2026) é real e datado. O resto é simulado e rotulado na interface. Nenhuma API, banco ou autenticação existe ainda.
