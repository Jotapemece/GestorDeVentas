# Plan: Transcripción completa del PDF al documento APA

## Contexto
`contenidoAPA.pdf` fue actualizado por el usuario y ahora es el documento completo:
incluye AGRADECIMIENTOS, DEDICATORIA, INTRODUCCIÓN y todo el Capítulo III
(Marco Metodológico) — incluyendo Técnicas e Instrumentos, Validez y Confiabilidad
y ejemplos de cuestionario. `contenido_apa.py` es una transcripción PARCIAL que
omite esas secciones, por lo que `Documento_APA.docx` actual no contiene ese
contenido. Objetivo: transcribir fielmente TODO el PDF (sin inventar ni omitir) y
actualizar `generador_apa.py` para renderizarlo.

## Fuente
PDF extraído en `/tmp/opencode/pdf_nuevo.txt` (1003 líneas). El cuerpo de Cap I y
Cap II ya coincide con el `contenido_apa.py` actual (verificado), así que se
conservan. Solo se AÑADEN/AMPLÍAN: preliminares, introducción y Cap III.

## Cambios en `trabajo/contenido_apa.py`
1. **docstring**: actualizar nota (el PDF ya incluye preliminares).
2. **AGRADECIMIENTOS / DEDICATORIA / INTRODUCCION**: rellenar con el texto fiel
   del PDF (4 + 4 + 6 párrafos respectivamente, unidos línea a línea).
3. **CAP3** (reemplazar el bloque actual) con estructura ampliada:
   - `tipo_investigacion`: objeto (aplicada, Niño 2011) + fuente (campo, Arias
     2012) + alcance (explicativa, Baptista 2014) — fiel al PDF.
   - `diseno`: Franco (2011) + organización en 4 partes.
   - `enfoque`: mixta (Johson et al. 2006).
   - `poblacion_muestra`: dict con `poblacion` (Tamayo y Tamayo 1997) y
     `muestra` (Tamayo y Tamayo 2006, intencionada).
   - `tecnicas_instrumentos`: dict con `intro` (Hurtado 2010), `tecnicas`
     [Encuesta, Entrevista, Observación, Revisión documental], `instrumentos_intro`
     (Tamayo/Sabino), `instrumentos` [Cuestionario+ejemplo, Guía de entrevista,
     Guía de Observación, Matriz de Registro], `ejemplo_entrevista` (5 ítems),
     `ejemplo_encuesta` (10 dicotómicas).
   - `validez_confiabilidad`: `validez` (Hernandez 1998, Escobar 2008, 3 expertos)
     y `confiabilidad` (Ruiz/Hernandez 2003, KR-20).
   - `variables`: se conserva la tabla de operacionalización existente.

## Cambios en `trabajo/generador_apa.py`
1. **INDICE**: añadir AGRADECIMIENTOS, DEDICATORIA, y en Cap III añadir
   "Técnicas e instrumentos" (`bm_c3_tec`) y "Validez y Confiabilidad"
   (`bm_c3_val`); renombrar "Tipo" → "Tipos de investigación".
2. **main() Cap III**: renderizar en orden del PDF:
   Tipos → Diseño → Enfoque → Población y muestra (subtítulos Población/Muestra)
   → Técnicas e instrumentos (subtítulos por técnica e instrumento, + ejemplos)
   → Validez y Confiabilidad (subtítulos Validez/Confiabilidad) → al final, en
   sección landscape, Operacionalización de Variables.
3. **Fix numeración**: tras crear `sec_op` (landscape) llamar
   `agregar_numeracion_superior_der(doc, sec_op)` para que la numeración de
   página también aparezca en esa sección.

## Verificación
- Ejecutar `python3 generador_apa.py` desde `trabajo/` → regenera `Documento_APA.docx`.
- Comprobar que frases clave de las secciones antes ausentes están en el docx
  (grep del xml o conversión a texto): "Técnicas e instrumentos", "Matriz de
  Registro", "KR-20", "Validez de contenido", "Revisión documental".
- Confirmar que no hay texto inventado (todo proviene del PDF).

## Notas
- El PDF repite "Objetivo General" al inicio de Cap III (línea ~660); es un
  duplicado del Objetivo General ya presente en Cap I, por lo que NO se vuelve a
  imprimir para evitar redundancia.
- Se conserva `PORTADA` como metadato (no está en el PDF).
- `contenido.py` (reporte H&M) es un documento distinto; no se toca.
