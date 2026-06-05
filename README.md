# Porra Ezpeleta

Landing React para ver el Top 5 de la porra familiar en una sola pantalla, sin scroll en movil ni escritorio.

## Arranque

```bash
npm install
npm run dev
```

## Datos reales

La web no trae datos de ejemplo. Si no hay fuente conectada, muestra un estado pendiente.

Para cambiar la fuente, crea `.env.local` copiando `.env.example`.

### Excel

1. Abre el Excel y entra en la hoja concreta donde salen los resultados.
2. Exporta o guarda esa hoja como CSV.
3. Coloca el archivo en `public/porra.csv`.
4. Usa:

```bash
VITE_DATA_SOURCE=excel
VITE_EXCEL_CSV_PATH=/porra.csv
```

Tambien puedes usar `VITE_DATA_SOURCE=csv`.

Si tu Excel tiene varias hojas, no pasa nada: exporta solo la hoja de resultados. Cuando tengas el archivo final, pasamelo y ajusto el lector a los nombres reales de la hoja y columnas.

No he incluido lectura directa de `.xlsx` en el navegador porque el parser habitual para Vite trae vulnerabilidades altas sin fix disponible. La ruta CSV deja la integracion preparada sin meter ese riesgo en la web.

### Google Sheets como CSV

Puedes publicar la hoja como CSV o usar el ID de la hoja:

```bash
VITE_DATA_SOURCE=google_sheets_csv
VITE_GOOGLE_SHEET_CSV_URL=
VITE_GOOGLE_SHEET_ID=
VITE_GOOGLE_SHEET_GID=0
```

En Google Sheets, cada pestana tiene un `gid` distinto. Para varias hojas, usa el `gid` de la pestana donde este la clasificacion.

### Google Sheets API

Para una hoja accesible con API key:

```bash
VITE_DATA_SOURCE=google_sheets_api
VITE_GOOGLE_SHEETS_API_KEY=tu_api_key
VITE_GOOGLE_SHEET_ID=tu_sheet_id
VITE_GOOGLE_SHEET_RANGE=NombreDeLaHoja!A:D
```

## Columnas esperadas

La web reconoce estos nombres de columnas, con o sin mayusculas:

- `Puesto`, `Posicion`, `Position`, `Rank`
- `Nombre`, `Participante`, `Jugador`, `Equipo`
- `Puntos`, `Pts`, `Points`, `Total`
- `Aciertos`, `Correctos`, `Hits`

Solo se muestran los cinco primeros.
