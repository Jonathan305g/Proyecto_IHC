# Referencias tecnicas de exportacion

Los archivos S4-07_referencia.md y .pdf se generaron por HTTP con el servicio real
y PostgreSQL PGlite. Usan datos de prueba controlados, nunca participantes reales.
El PDF contiene una pagina, acentos espanoles, las mismas tablas de Markdown,
hallazgo aprobado, historia y origen BIGINT 9007199254740993 sin perder precision.
No incluye observaciones originales, correos ni hallazgos de otro periodo.

S4-07_paginacion.pdf contiene 130 filas en cinco paginas con cabecera de tabla
repetida y pie numerado. Se comprobaron primera y ultima pagina mediante render,
texto con pdftotext y metadatos con pdfinfo. Sin recortes ni solapamientos.

Estas referencias no acreditan la ejecucion de S4-09 con usuarios. Los datos se
pueden reproducir con S4_EVIDENCE_DIR y backend/test/s4-07-reports.test.cjs.
