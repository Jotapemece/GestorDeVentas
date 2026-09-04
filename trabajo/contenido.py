# -*- coding: utf-8 -*-
# Contenido del informe de pasantías IUTECP — EMPRESA H&M GRUPO EMPRESARIAL, C.A.
# Pasante: Leonardo Escobar (C.I. V-32.412.031)

# ========================================================================
# 1. RUTAS, IMÁGENES Y CUADROS
# ========================================================================
CARPETA_IMAGENES = 'imagenes'

GRAFICOS = [
    {
        'numero': 1,
        'archivo': 'mapa.png',
        'tras': 'ubicacion',
        'titulo': 'Gráfico 1. Ubicación geográfica de la Empresa H & M Grupo Empresarial C.A.',
        'ancho_cm': 12,
        'lista': 'Ubicación geográfica de la Empresa H & M Grupo Empresarial C.A.',
        'pagina': '',
        'fuente': 'Captura cartográfica de Google Maps (2025).'
    },
]

# Cuadros del documento: (número, descripción, página) — se rellenan al finalizar contenido
CUADROS_INDICE = [
    ("1", "Planificación integral de los objetivos específicos.", ""),
    ("2", "Cronograma de actividades administrativas.", ""),
]

# Figuras del documento (tras = ancla donde se inserta; pagina_propia = salto antes/después)
FIGURAS = [
    {
        'numero': 1,
        'archivo': 'organigrama.png',
        'tras': 'estructura',
        'titulo': 'Figura 1. Organigrama estructural y jerárquico de la Empresa H & M Grupo Empresarial C.A.',
        'ancho_cm': 16,
        'lista': 'Organigrama estructural y jerárquico de la Empresa H & M Grupo Empresarial C.A.',
        'pagina': '',
        'fuente': 'Fuente: Elaboración propia del autor (2026).',
        'pagina_propia': True,
    },
]

PLANIFICACION_INTRO_TEXTO = ('La planificación establece la relación entre cada objetivo específico y las '
 'actividades a ejecutar para el logro de la propuesta:')
CRONOGRAMA_INTRO_TEXTO = ('A continuación, se detalla el cronograma de actividades correspondiente a las diez '
 'semanas de prácticas profesionales desarrolladas en el departamento Administrativo y Contable de '
 'H & M GRUPO EMPRESARIAL C.A.')
CUADRO_PLANIFICACION_TITULO = 'Cuadro 1. Planificación integral de los objetivos específicos.'
CUADRO_CRONOGRAMA_TITULO = 'Cuadro 2. Cronograma de actividades administrativas.'
CRONOGRAMA_FUENTE = 'Fuente: Elaboración propia del autor (2026).'

# ========================================================================
# 2. DATOS DE PORTADA
# ========================================================================
MEMBRETE = ['REPÚBLICA BOLIVARIANA DE VENEZUELA',
 'MINISTERIO DEL PODER POPULAR PARA LA EDUCACIÓN UNIVERSITARIA',
 'INSTITUTO UNIVERSITARIO DE TECNOLOGÍA',
 '"ELÍAS CALIXTO POMPA"',
 'EL TIGRE, ESTADO ANZOÁTEGUI']

TITULO_PROYECTO = ('PROPUESTA DE UN SISTEMA DE INFORMACIÓN CONTABLE PARA OPTIMIZAR LA GESTIÓN '
 'DE DATOS FINANCIEROS Y EL CUMPLIMIENTO DE LOS DEBERES FORMALES EN LA EMPRESA '
 'H & M GRUPO EMPRESARIAL C.A.')

AUTOR_DATOS = ['Autor:',
 'Leonardo Escobar',
 'C.I.: V-32.412.031',
 '',
 'Tutor Industrial:',
 'Fernando Hernandez',
 'C.I.: V-17.125.606',
 '',
 'Tutor Académico:',
 'Mejía José',
 'C.I.: 4.273.815']

FECHA_LUGAR = 'El Tigre, agosto de 2026'

CIUDAD_FECHA = FECHA_LUGAR

NOMBRE_PASANTE = 'Leonardo Escobar'

CI_PASANTE = 'V-32.412.031'

ESPECIALIDAD = 'Informática'

RAZON_SOCIAL = 'H & M GRUPO EMPRESARIAL C.A., RIF: J-29785518-1'

# ========================================================================
# 3. PÁGINAS PRELIMINARES (se dejan en blanco hasta indicar texto)
# ========================================================================
AGRADECIMIENTOS = [
    'Ante todo, elevo mi gratitud a Dios, por otorgarme la salud, la fortaleza y la '
    'perseverancia necesarias para transitar cada etapa de mi formación académica y guiar '
    'mis pasos hasta la culminación de este importante objetivo.',
    'A mis padres y a mi familia, por constituir el pilar fundamental sobre el cual se '
    'erige este logro; gracias por cada sacrificio, por su confianza incondicional y por '
    'el apoyo constante que me permitieron alcanzar esta meta.',
    'Expreso, de igual manera, mi sincero reconocimiento al Instituto Universitario de '
    'Tecnología "Elías Calixto Pompa" (IUTECP) y a su cuerpo docente, por cimentar en mí '
    'las bases profesionales de la especialidad de Informática. Extiendo este '
    'agradecimiento a la empresa H & M Grupo Empresarial C.A. y, en especial, al '
    'departamento Administrativo/Contable (Lcda. Marta Rojas y Diego Aray), por abrirme '
    'las puertas de sus instalaciones y brindarme la valiosa oportunidad de desarrollarme '
    'en el entorno operativo; así como a mis tutores, cuya orientación fue decisiva para '
    'la consolidación de este proyecto.',
]

DEDICATORIA = [
    'Ofrezco de todo corazón este logro, en primer lugar, a Dios, por bendecirme con la '
    'salud, el entendimiento y la fortaleza indispensables para mantenerme firme en los '
    'momentos de mayor exigencia y guiar mi rumbo hasta el cierre de esta etapa.',
    'A mis padres, por ser el pilar incondicional de cada uno de mis pasos. Sin su amor '
    'desinteresado, sus sacrificios y esa confianza inquebrantable depositada en mí, no '
    'habría sido posible ver materializado este sueño; este triunfo también les pertenece.',
    'Finalmente, dedico esta meta a mi familia, compañeros y amigos, quienes con su '
    'compañía, consejos y palabras de aliento hicieron más ameno el trayecto y '
    'contribuyeron a que este objetivo se hiciera realidad.',
]

RESUMEN_TEXTO = ('El presente informe de pasantía tuvo como objetivo proponer un sistema de '
 'información contable para optimizar la gestión de datos financieros y el cumplimiento '
 'de los deberes formales en la H & M Grupo Empresarial C.A., del sector turismo y '
 'hostelería, ubicada en El Tigre, estado Anzoátegui. La investigación abordó el registro '
 'manual de las transacciones en el departamento Administrativo/Contable, situación que '
 'generaba demoras en la búsqueda de comprobantes, errores en el procesamiento de las '
 'operaciones y riesgos en el cumplimiento de las obligaciones fiscales. '
 'Metodológicamente, se desarrolló como un proyecto factible, apoyado en investigación de '
 'campo y revisión documental, con la Matriz FODA como técnica de diagnóstico y '
 'siguiendo las fases del análisis de sistemas: levantamiento de requerimientos, '
 'modelado de la base de datos (entidad-relación), diseño de la interfaz y prototipado '
 'funcional. Como resultado, se consolidó la estructura de una solución informática que '
 'centraliza el registro de la facturación, los libros contables y las retenciones, '
 'facilitando la consulta oportuna para el personal del departamento (Lcda. Marta Rojas '
 'y Diego Aray). Se concluye que la sistematización del flujo de datos financieros '
 'reduce los tiempos de respuesta, minimiza el margen de error humano y fortalece el '
 'control interno exigido por las auditorías fiscales; por ello, se recomienda la '
 'implantación paulatina del sistema y la capacitación del personal. La propuesta, en '
 'definitiva, demuestra que la tecnología es un pilar fundamental para la transparencia '
 'y la sostenibilidad de la organización.')

PALABRAS_CLAVE = ('Sistema de información contable, gestión de datos financieros, deberes '
 'formales tributarios, control interno contable, automatización de procesos, '
 'H & M Grupo Empresarial.')

INTRODUCCION_TEXTO = [
    'En la actualidad, la gestión eficiente de la información financiera y la adopción '
    'de soluciones tecnológicas se han consolidado como factores decisivos para la '
    'competitividad y la sostenibilidad de las organizaciones. La contabilidad, como '
    'fuente primaria de los datos económicos de una entidad, requiere herramientas que '
    'permitan registrar, procesar y consultar las operaciones de manera ágil, segura y '
    'trazable. Ante ello, los sistemas de información contable emergen como una '
    'alternativa idónea para centralizar los registros, reducir los errores humanos y '
    'garantizar el cumplimiento oportuno de las obligaciones formales.',
    'El presente informe documenta la experiencia de pasantías realizada en la empresa '
    'H & M Grupo Empresarial C.A., específicamente en el departamento '
    'Administrativo/Contable, ubicado en El Tigre, estado Anzoátegui. A través del diseño '
    'de una propuesta de sistema de información contable, se busca resolver el manejo '
    'manual y desactualizado de las transacciones financieras, situación que generaba '
    'demoras, errores y riesgos de incumplimiento fiscal. De esta manera, el mencionado '
    'planteamiento dio lugar a la elaboración del presente informe, estructurándolo de '
    'la siguiente manera:',
    'Capítulo I, Realidad Organizacional: Se presenta la información general de la '
    'empresa donde se llevó a cabo la pasantía, tales como su razón social, reseña '
    'histórica, misión, visión, ubicación geográfica y la estructura organizacional, '
    'tanto general como del departamento administrativo/contable.',
    'Capítulo II, Diagnóstico Situacional: Se describe la necesidad operativa que '
    'motivó la realización de la pasantía, los objetivos general y específicos que '
    'orientaron el estudio, así como la planificación integral de los objetivos y el '
    'cronograma de actividades.',
    'Capítulo III, Marco Teórico: Se exponen los fundamentos conceptuales relacionados '
    'con la contabilidad y la gestión financiera, las tecnologías de información y '
    'diseño de software, y la automatización de los procesos contables.',
    'Capítulo IV, Actividades Realizadas: Se presenta la descripción detallada de las '
    'actividades ejecutadas por semana durante el periodo de pasantías, integrando el '
    'apoyo operativo en el departamento y el desarrollo técnico del proyecto de '
    'sistemas.',
    'Capítulo V, Conclusiones y Recomendaciones: Se presentan los resultados alcanzados '
    'durante el desarrollo de la pasantía, así como las conclusiones del estudio y las '
    'sugerencias orientadas a la futura implantación del sistema en la empresa.',
]

# ========================================================================
# 4. CAPÍTULO I — REALIDAD ORGANIZACIONAL
# ========================================================================
RESENA_HISTORICA = [
    'La empresa H & M Grupo Empresarial C.A. se formó en el mes de junio del año 2009, '
    'iniciando con la construcción del Motel Mancora Suites, el cual estuvo lista en agosto del '
    'año 2011; el 30 de septiembre de 2011 abrió sus puertas con el propósito de ofrecer '
    'alojamientos económicos y cómodos, priorizando la accesibilidad, el estacionamiento '
    'conveniente y un proceso de registro rápido y seguro, buscando brindar un ambiente '
    'discreto para sus clientes.',
    'En el año 2012 surgió la necesidad de ampliar las opciones de hospedaje por demanda del '
    'mercado y se inició la construcción de las primeras 22 habitaciones del Hotel Premier, '
    'el cual se inauguró en abril de 2013, con una excelente instalación de alta calidad. En '
    '2014 se construyeron la piscina, la terraza y 44 habitaciones más del Hotel Premier, para '
    'complementar un hospedaje de alta calidad 4 estrellas.',
    'En el año 2023 nació el sueño de construir un espacio recreativo polideportivo, el cual se '
    'inauguró en enero de 2024 con el nombre de Parque Premier Aventura, proporcionando '
    'entretenimiento y diversión a través de una variedad de atracciones, juegos, espectáculos '
    'y actividades recreativas.',
]

MISION = ('Nuestra misión es ser el destino predilecto para el descanso, la gastronomía y el '
 'entretenimiento, ofreciendo una experiencia inigualable en nuestro hotel y motel, con una '
 'exquisita oferta culinaria en nuestro restaurante y momentos de diversión en nuestras áreas '
 'recreativas, superando las expectativas de nuestros huéspedes con un servicio atento y '
 'personalizado, creando recuerdos duraderos y la sensación de un hogar lejos de casa.')

VISION = ('Ser los organizaciones reconocidas como el complejo turístico líder en la región, '
 'sinónimo de excelencia en hospedaje, gastronomía de primer nivel y opciones de ocio '
 'innovadoras, destacando por la calidad integral de nuestros servicios, la singularidad de '
 'nuestra propuesta culinaria y la diversidad de nuestras instalaciones recreativas.')

VALORES = [
    ('Excelencia en el servicio', 'Brindar una experiencia memorable a cada huésped y visitante, superando sus expectativas en el hospedaje, la gastronomía y el entretenimiento.'),
    ('Responsabilidad', 'Asumir con compromiso y dedicación las tareas asignadas, garantizando la calidad y la transparencia en cada proceso administrativo y operativo.'),
    ('Trabajo en equipo', 'Fomentar la colaboración y la comunicación entre las distintas áreas para alcanzar objetivos comunes y ofrecer un servicio integral.'),
    ('Integridad y honestidad', 'Actuar con ética y rectitud en el manejo de la información financiera, los recursos de la organización y las relaciones con clientes y colaboradores.'),
    ('Innovación y mejora continua', 'Impulsar la adopción de nuevas tecnologías y la optimización permanente de los procesos, buscando la excelencia operativa.'),
    ('Respeto por las personas', 'Valorar a clientes, colaboradores y proveedores, cultivando un ambiente laboral armónico, inclusivo y de trato cordial.'),
]

OBJETIVO_GENERAL_EMPRESA = ('Consolidar al complejo turístico como el destino predilecto de la región para el descanso, la '
 'gastronomía y el entretenimiento, garantizando la calidad integral de sus servicios, la rentabilidad '
 'sostenible del negocio y el pleno cumplimiento de las obligaciones contables y fiscales de la organización.')

OBJETIVOS_ESPECIFICOS_EMPRESA = [
    'Ofrecer una experiencia única y personalizada de hospedaje, gastronomía y recreación que supere las expectativas de los clientes.',
    'Optimizar los procesos operativos y administrativos de las unidades de negocio (hotel, motel, restaurante y parque recreacional) mediante la automatización de la información.',
    'Garantizar el registro, control y resguardo de las transacciones financieras para el cumplimiento oportuno de los deberes formales y fiscales.',
    'Fortalecer el talento humano a través de la capacitación continua y la motivación del personal.',
    'Promover el crecimiento sostenible de la empresa mediante la innovación, la diversificación de servicios y el aprovechamiento de las oportunidades del mercado.',
]

UBICACION = ('La empresa se encuentra ubicada en la Carretera vía Las Mercedes, a 200 metros de '
 'la Redoma de Aguanca, El Tigre 6050, Estado Anzoátegui, Municipio Simón Rodríguez.')

POBLACION_TABLA = None

POBLACION_FUENTE = ''

POBLACION = []

ORGANIGRAMA_TEXTO = [
    'Esta organización se establece con una jerarquía clara que desciende desde la dirección '
    'estratégica hasta las operaciones diarias, asegurando que cada área funcional trabaje en '
    'conjunto hacia los objetivos de la empresa. La máxima autoridad es la Presidencia, '
    'seguida de la Vicepresidencia y la Gerencia General, de la cual dependen las áreas de '
    'Administración (Contabilidad y Recursos Humanos), la Gerencia de Hotel y Motel, la '
    'Gerencia de Restaurante y la Gerencia de Parque Recreacional.',
    'La práctica profesional se desarrolló en el Departamento Administrativo/Contable, '
    'responsable de registrar, clasificar, resumir e interpretar todas las transacciones '
    'financieras de la empresa. El equipo del departamento contable está integrado por la '
    'Jefa del Departamento, Lcda. Marta Rojas, y el Asistente, Diego Aray.',
    'Entre sus funciones destacan: el registro de transacciones, la elaboración de libros '
    'contables, la preparación de estados financieros, las conciliaciones bancarias, el '
    'cumplimiento fiscal (IVA, ISLR), el control presupuestario, el análisis financiero, la '
    'gestión de cuentas por cobrar y pagar, las auditorías, y la gestión de archivos y '
    'documentación.',
]

# ========================================================================
# 5. CAPÍTULO II — DIAGNÓSTICO SITUACIONAL
# ========================================================================
SITUACION_PROBLEMATICA = [
    'En la actualidad, el manejo óptimo de la información financiera y contable representa un '
    'eje fundamental para garantizar la productividad, la transparencia y la preservación del '
    'conocimiento dentro de cualquier organización. La evolución tecnológica impone a las '
    'corporaciones el desafío de sistematizar sus procesos, persiguiendo no solo la '
    'inmediatez en la consulta de datos, sino también el resguardo seguro y la trazabilidad '
    'absoluta de cada soporte contable o fiscal. Cuando una entidad carece de herramientas '
    'automatizadas para gobernar su información económica, se generan brechas operacionales '
    'que vulneran de manera directa su eficiencia y entorpecen el cumplimiento de sus '
    'compromisos corporativos.',
    'Dentro del territorio venezolano, las organizaciones dedicadas al sector turismo, '
    'hostelería y servicios se desenvuelven en un entorno de alta exigencia técnica y '
    'regulatoria que demanda esquemas de control interno rigurosos para amparar su gestión '
    'frente a las constantes auditorías fiscales y operativas del Estado. Pese a esta '
    'necesidad, persisten fallas institucionales generalizadas en el sector, donde la '
    'conservación y distribución de los soportes contables y fiscales aún se ejecuta '
    'mediante métodos tradicionales, manuales y desarticulados, propiciando la '
    'vulnerabilidad de la información y comprometiendo el cumplimiento oportuno de los '
    'deberes formales, como la facturación, los libros contables y las declaraciones.',
    'En esta realidad se inserta la empresa H & M Grupo Empresarial C.A., donde el '
    'departamento Administrativo/Contable procesa manualmente las transacciones financieras '
    'de sus unidades de negocio (hotel, motel, restaurante y parque recreacional). Este '
    'manejo manual y desactualizado de la información genera cuellos de botella, demoras '
    'en la búsqueda de comprobantes, errores en el registro de operaciones y un riesgo '
    'latente de inconsistencias en el cumplimiento de los deberes fiscales, exponiendo a la '
    'empresa a posibles sanciones legales. Dicha problemática, originada por la carencia de '
    'un software contable estandarizado, evidencia la necesidad de una propuesta de sistema '
    'de información contable que agilice el flujo de datos y minimice el margen de error '
    'humano.',
    'Para sustentar este diagnóstico, se aplicó la técnica de la Matriz FODA, mediante la '
    'cual se identificaron las fortalezas, debilidades, oportunidades y amenazas que '
    'caracterizan la gestión financiera del departamento contable. Entre las debilidades '
    'destacan el registro manual de las operaciones y la ausencia de controles '
    'automatizados; entre las amenazas, el incumplimiento o posible contrario '
    'sancionatorio ante el Estado; mientras que entre las fortalezas y oportunidades '
    'sobresalen la disposición del personal (Lcda. Marta Rojas y Diego Aray) a la '
    'automatización y la factibilidad tecnológica de la propuesta. Este análisis permitió '
    'formular la siguiente interrogante: ¿Cómo optimizar la gestión de datos financieros y '
    'el cumplimiento de los deberes formales en la H & M Grupo Empresarial C.A., mediante '
    'la propuesta de un sistema de información contable?',
]

INTERROGANTE_TITULO = 'Interrogante orientadora'

INTERROGANTE_PROBLEMA = ''

OBJETIVO_GENERAL = ('Proponer un sistema de información contable para optimizar la gestión de '
 'datos financieros y el cumplimiento de los deberes formales en la empresa H & M Grupo '
 'Empresarial C.A.')

OBJETIVOS_ESPECIFICOS = [
    'Diagnosticar la situación actual de la gestión de datos financieros y los procedimientos del departamento contable de la empresa.',
    'Diseñar la propuesta de un sistema de información contable acorde a los requerimientos identificados.',
    'Validar la factibilidad de la propuesta del sistema contable modular para el cumplimiento de los deberes formales de la empresa.',
]

PLANIFICACION_DATOS = [
    (
        'Diagnosticar la situación actual de la gestión de datos financieros y los procedimientos del departamento contable.',
        'Requerimientos Funcionales y No Funcionales, y Procesos Contables Actuales.',
        '• Entrevistas con Lcda. Marta Rojas y personal contable.\n• Observación directa de tareas de facturación, libros contables y retenciones.\n• Revisión de formularios y documentos fiscales.',
        '• Entrevista no estructurada.\n• Observación participante.\n• Revisión documental.',
        '• Guión de entrevista.\n• Guía de observación.\n• Lista de cotejo.',
    ),
    (
        'Diseñar la propuesta de un sistema de información contable acorde a los requerimientos identificados.',
        'Arquitectura de Datos, Esquemas de Base de Datos (E-R) y Diseño de Interfaz UI/UX.',
        '• Modelado Entidad-Relación y diagramas de flujo de datos.\n• Maquetación de pantallas (mockups) para Facturación, Libros y Reportes.\n• Selección de tecnologías y definición de arquitectura.',
        '• Modelado de Sistemas (UML).\n• Prototipado rápido.\n• Diseño de Software.',
        '• Diagramas UML (Casos de Uso, E-R).\n• Prototipos de interfaz (UI).\n• Matriz de trazabilidad.',
    ),
    (
        'Validar la factibilidad de la propuesta del sistema contable modular para el cumplimiento de los deberes formales de la empresa.',
        'Funcionalidad del Sistema, Integración Modular y Automatización de Registros.',
        '• Elaboración de un prototipo funcional del sistema contable.\n• Integración del módulo de Facturación con Contabilidad.\n• Ejecución de pruebas unitarias y de integración para validar el registro y el cumplimiento fiscal.\n• Capacitación de usuarios finales (Lcda. Marta Rojas, Diego Aray).',
        '• Pruebas unitarias y de integración.\n• Validación de software.\n• Capacitación técnica.',
        '• Prototipo funcional.\n• Matriz de pruebas y errores.\n• Registro de capacitación de usuarios.',
    ),
]

CRONOGRAMA_DATOS = [
    {
        'desc': ('Operativa: Inducción al entorno laboral, revisión de normativas internas y '
            'reconocimiento de la documentación y flujos contables.'),
        'tipo': 'operativa',
        'semanas': [True, False, False, False, False, False, False, False, False, False],
    },
    {
        'desc': ('Proyecto: Seguimiento al procesamiento de información financiera, levantamiento '
            'de herramientas informáticas y detección de necesidades.'),
        'tipo': 'investigacion',
        'semanas': [False, True, False, False, False, False, False, False, False, False],
    },
    {
        'desc': ('Proyecto: Definición de requerimientos del sistema, mapeo del recorrido documental '
            'y estructuración del diagrama de Gantt.'),
        'tipo': 'investigacion',
        'semanas': [False, False, True, False, False, False, False, False, False, False],
    },
    {
        'desc': ('Operativa / Proyecto: Organización de expedientes físicos/digitales, trazado de '
            'diagramas procedimentales y creación de la base de datos inicial.'),
        'tipo': 'mixta',
        'semanas': [False, False, False, True, False, False, False, False, False, False],
    },
    {
        'desc': ('Proyecto: Definición de políticas de acceso e integridad de datos, y presentación '
            'del prototipo conceptual de las interfaces.'),
        'tipo': 'investigacion',
        'semanas': [False, False, False, False, True, False, False, False, False, False],
    },
    {
        'desc': ('Proyecto: Programación e integración técnica de los módulos del sistema y pruebas '
            'de conexión con la base de datos.'),
        'tipo': 'investigacion',
        'semanas': [False, False, False, False, False, True, False, False, False, False],
    },
    {
        'desc': ('Operativa / Proyecto: Archivo correlativo, asistencia en cierres de información, '
            'orientación preliminar al personal y avance del Capítulo I.'),
        'tipo': 'mixta',
        'semanas': [False, False, False, False, False, False, True, False, False, False],
    },
    {
        'desc': ('Operativa / Proyecto: Consolidación de reportes solicitados por la gerencia y '
            'ejecución de pruebas piloto de usabilidad del sistema.'),
        'tipo': 'mixta',
        'semanas': [False, False, False, False, False, False, False, True, False, False],
    },
    {
        'desc': ('Proyecto: Depuración del código, optimización del aplicativo y redacción de los '
            'manuales técnicos y de usuario.'),
        'tipo': 'investigacion',
        'semanas': [False, False, False, False, False, False, False, False, True, False],
    },
    {
        'desc': ('Operativa / Proyecto: Presentación oficial del sistema contable, entrega de '
            'manuales, capacitación final al personal y cierre de pasantías.'),
        'tipo': 'mixta',
        'semanas': [False, False, False, False, False, False, False, False, False, True],
    },
]

# ========================================================================
# 6. CAPÍTULO III — MARCO TEÓRICO
# ========================================================================
BASES_TEORICAS_INTRO = ('El marco conceptual de la investigación reúne los enfoques teóricos que '
 'fundamentan la propuesta del sistema de información contable para la H & M Grupo '
 'Empresarial C.A. Esta sección recopila la literatura científica y técnica necesaria '
 'para comprender cómo la implementación de dicho sistema se convierte en una '
 'herramienta estratégica para la optimización de los procesos contables y el '
 'cumplimiento de los deberes formales.')

BASES_TEORICAS = [
    {
        'titulo': '3.1. Fundamentos de Contabilidad y Gestión Financiera',
        'nivel': 2,
        'parrafos': [],
    },
    {
        'titulo': '3.1.1. Sistema de Información Contable',
        'nivel': 3,
        'parrafos': [
            'Según Fernando Catacora, un sistema de información contable es una estructura '
            'organizada mediante la cual se recopilan, clasifican, registran y resumen los '
            'eventos financieros de una entidad, con el objetivo principal de generar reportes '
            'útiles y oportunos que faciliten la toma de decisiones administrativas y el control '
            'fiscal. Este concepto implica, además, la integración ordenada de datos, '
            'procedimientos y personas, de modo que cada transacción quede documentada, '
            'reproducible y disponible en el momento en que la gerencia lo requiera, '
            'convirtiéndose en la base sobre la cual se estructura la solución propuesta.',
        ],
    },
    {
        'titulo': '3.1.2. Gestión de Datos Financieros',
        'nivel': 3,
        'parrafos': [
            'De acuerdo con Charles Horngren, la gestión de datos financieros abarca el procesamiento '
            'sistemático, la cuantificación y la administración del flujo de información '
            'monetaria dentro de una organización, garantizando que los registros reflejen con '
            'precisión la realidad económica patrimonial de la empresa. Una adecuada gestión '
            'implica, además, el almacenamiento seguro, la trazabilidad de cada operación y la '
            'consolidación de los datos en reportes confiables, elementos indispensables para '
            'respaldar la planificación contable y las obligaciones fiscales.',
        ],
    },
    {
        'titulo': '3.1.3. Deberes Formales Tributarios',
        'nivel': 3,
        'parrafos': [
            'Para Edgar Moya Millán, los deberes formales son el conjunto de obligaciones '
            'impuestas por la legislación tributaria a los contribuyentes para facilitar la '
            'fiscalización y verificación del cumplimiento impositivo, abarcando la emisión '
            'reglamentaria de facturas, el mantenimiento de libros contables y la ejecución de '
            'retenciones. El cumplimiento oportuno y documentado de estos deberes constituye un '
            'requisito esencial para evitar sanciones, por lo que la automatización de su '
            'registro reduce de forma significativa los riesgos de incumplimiento.',
        ],
    },
    {
        'titulo': '3.1.4. Control Interno Contable',
        'nivel': 3,
        'parrafos': [
            'Tal como indica Rodrigo Estupiñán Gaitán, el control interno comprende el plan '
            'organizativo y los métodos coordinados que adopta una empresa para salvaguardar sus '
            'activos, verificar la exactitud de los registros financieros y promover la '
            'eficiencia en el flujo de las operaciones administrativas. Un control interno '
            'efectivo se apoya en procedimientos claramente definidos, segregación de '
            'funciones y revisiones periódicas, aspectos que un sistema de información contable '
            'estructurado contribuye a reforzar mediante la estandarización del registro.',
        ],
    },
    {
        'titulo': '3.2. Tecnologías de Información y Diseño de Software',
        'nivel': 2,
        'parrafos': [],
    },
    {
        'titulo': '3.2.1. Bases de Datos Relacionales y SGBD',
        'nivel': 3,
        'parrafos': [
            'De acuerdo con Ramez Elmasri y Shamkant B. Navathe, las bases de datos relacionales permiten '
            'estructurar, almacenar y recuperar información mediante tablas relacionadas entre '
            'sí, y son gestionadas por un sistema de gestión de bases de datos (SGBD) que '
            'preserva la integridad y consistencia de los datos. En la práctica, este modelo '
            'facilita la consulta rápida de transacciones y comprobantes, evita la duplicación '
            'de registros y garantiza que la información financiera permanezca ordenada, '
            'respaldando las operaciones contables y fiscales de la organización.',
        ],
    },
    {
        'titulo': '3.2.2. Modelado Entidad-Relación',
        'nivel': 3,
        'parrafos': [
            'De acuerdo con Ramez Elmasri y Shamkant B. Navathe, el modelo entidad-relación es una herramienta '
            'conceptual empleada para el diseño de bases de datos que representa el mundo real '
            'mediante entidades y sus asociaciones, sirviendo como mapa estructural para el '
            'almacenamiento lógico de la información. Este diagrama permite visualizar cómo se '
            'conectan los datos de clientes, productos, facturas y libros contables antes de '
            'implementar la base de datos, lo que reduce errores de diseño y facilita el '
            'mantenimiento posterior del sistema.',
        ],
    },
    {
        'titulo': '3.2.3. Arquitectura de Software',
        'nivel': 3,
        'parrafos': [
            'Para Ian Sommerville, la arquitectura de software define la estructura global del '
            'sistema informático y la organización de sus componentes, determinando la forma en '
            'que interactúan los módulos de almacenamiento, procesamiento y generación de '
            'reportes. Una arquitectura modular y bien definida permite separar la interfaz del '
            'usuario de la lógica de negocio, facilitando la escalabilidad, el mantenimiento y la '
            'incorporación de nuevos módulos (facturación, libros y reportes) en el futuro.',
        ],
    },
    {
        'titulo': '3.2.4. Prototipado de Software',
        'nivel': 3,
        'parrafos': [
            'Según Jeffrey Whitten y Lonnie Bentley, el prototipado es un enfoque de desarrollo que permite '
            'construir modelos preliminares e interactivos del sistema para que los usuarios '
            'validen los requerimientos funcionales, evalúen la interfaz y se reduzcan los '
            'riesgos de rediseño en fases avanzadas del proyecto. Al presentar una versión '
            'temprana y visual del sistema, los usuarios pueden aportar correcciones sobre lo '
            'que realmente requieren antes de la implementación definitiva, reduciendo '
            'costos y tiempo de desarrollo.',
        ],
    },
    {
        'titulo': '3.2.5. Interfaz de Usuario',
        'nivel': 3,
        'parrafos': [
            'Conforme a lo expuesto por Jakob Nielsen, la interfaz de usuario constituye el '
            'entorno de interacción entre la persona y la aplicación informática, la cual debe '
            'ser diseñada bajo principios de usabilidad para minimizar errores operativos '
            'durante la carga de información. Una interfaz clara y consistente, con etiquetas '
            'entendibles y flujos de trabajo naturales, facilita la capacitación del personal y '
            'reduce la resistencia al cambio, factor determinante en la adopción de un nuevo '
            'sistema.',
        ],
    },
    {
        'titulo': '3.2.6. Pruebas de Software',
        'nivel': 3,
        'parrafos': [
            'De acuerdo con Glenford Myers, las pruebas de software representan el proceso '
            'riguroso de ejecución de una aplicación con la intención explícita de detectar '
            'errores, validar la integración modular y asegurar que el sistema cumpla con las '
            'especificaciones técnicas requeridas. Esto incluye pruebas unitarias por módulo y '
            'pruebas de integración entre ellos, garantizando que el sistema contable presente '
            'resultados correctos en cada operación.',
        ],
    },
    {
        'titulo': '3.2.7. Ingeniería de Requerimientos',
        'nivel': 3,
        'parrafos': [
            'Como sostienen Kendall y Kendall, la ingeniería de requerimientos es la fase del '
            'análisis de sistemas enfocada en identificar, documentar y validar las necesidades '
            'reales de los usuarios finales dentro del entorno operativo. Su aplicación '
            'sistemática permite definir qué información debe manejar el sistema contable, '
            'evitando el desarrollo de funciones innecesarias y garantizando que la solución '
            'responda con precisión a los procesos de facturación, libros y declaraciones.',
        ],
    },
    {
        'titulo': '3.3. Automatización y Sistemas de Información Gerencial',
        'nivel': 2,
        'parrafos': [],
    },
    {
        'titulo': '3.3.1. Automatización de Procesos',
        'nivel': 3,
        'parrafos': [
'Tal como sostienen Marlon Dumas y sus colaboradores, la automatización de procesos consiste en '
            'reemplazar tareas operativas manuales y repetitivas por mecanismos '
            'computarizados, logrando agilizar el flujo de trabajo, reducir tiempos de '
            'respuesta e incrementar la trazabilidad de los datos. En el ámbito contable, '
            'la automatización del registro de operaciones minimiza los errores humanos, '
            'acelera la generación de reportes y libera al personal para dedicarse a '
            'actividades de mayor valor estratégico.',
        ],
    },
    {
        'titulo': '3.3.2. Sistemas de Información Gerencial (SIG)',
        'nivel': 3,
        'parrafos': [
            'James O\'Brien y George Marakas definen los sistemas de información gerencial como un conjunto de '
            'componentes interrelacionados que recolectan, procesan, almacenan y distribuyen '
            'información para apoyar la toma de decisiones, el control y la optimización en una '
            'organización. La propuesta se enmarca dentro de este concepto, toda vez que '
            'transforma los datos contables dispersos en información estructurada, permitiendo '
            'a la gerencia supervisar las operaciones y tomar decisiones basadas en datos '
            'veraces y oportunos.',
        ],
    },
]

POST_CITA_TEXTO = ''

# ========================================================================
# 7. CAPÍTULO IV — ACTIVIDADES REALIZADAS
# ========================================================================
ACTIVIDADES_DESCRIPCION = ('A continuación, se detallan las actividades que el pasante llevó a cabo '
 'durante su práctica profesional en la empresa H & M Grupo Empresarial C.A., '
 'específicamente en el departamento Administrativo/Contable. Este período, '
 'correspondiente a la carrera de TSU en Informática en el Instituto Universitario de '
 'Tecnología "Elías Calixto Pompa" (IUTECP), permitió aplicar los conocimientos '
 'teóricos de la especialidad en un entorno operativo real. Las labores abarcaron '
 'desde el diagnóstico procedimental y la gestión operativa, hasta la planificación '
 'estructural mediante diagramas de Gantt y el desarrollo de un proyecto de sistema '
 'de información contable.')

ACTIVIDADES_LISTA = [
    {
        'semana': 1,
        'operativa': ('Inducción al entorno laboral y reconocimiento de los procesos del '
            'departamento Administrativo/Contable.'),
        'operativa_parrafo': ('La jornada comenzó con la recepción por parte del tutor industrial. '
            'En este primer encuentro se realizó la presentación ante el equipo de trabajo del '
            'departamento, la revisión de las instalaciones y el análisis de las normativas '
            'internas, complementado con el examen del organigrama para ubicar el rol operativo '
            'del pasante dentro del área. Posteriormente, se llevó a cabo el reconocimiento de la '
            'documentación administrativa crítica, examinando las mecánicas de los reportes y '
            'registros financieros.'),
        'investigacion': ('Diagnóstico preliminar del flujo de información contable.'),
        'investigacion_parrafo': ('Esta labor brindó la base conceptual necesaria para evaluar los '
            'flujos de información contable de la empresa, identificando de forma inicial las '
            'fortalezas y debilidades del registro manual que sustentarían el diagnóstico del '
            'proyecto.'),
    },
    {
        'semana': 2,
        'operativa': ('Acompañamiento en el registro y validación de la información financiera '
            'diaria.'),
        'operativa_parrafo': ('El seguimiento directo al personal durante la recepción, validación y '
            'procesamiento de la información financiera diaria permitió observar la aplicación de '
            'los métodos de registro vigentes y determinar la fluidez en la respuesta '
            'procedimental del departamento.'),
        'investigacion': ('Levantamiento de herramientas informáticas y detección de necesidades '
            'funcionales.'),
        'investigacion_parrafo': ('De forma paralela, se realizó un levantamiento detallado de las '
            'herramientas informáticas utilizadas en las estaciones de trabajo, identificando los '
            'cuellos de botella operativos y las necesidades funcionales que justificarían el '
            'desarrollo del nuevo sistema de información contable.'),
    },
    {
        'semana': 3,
        'operativa': ('Verificación y actualización de comprobantes contables del período.'),
        'operativa_parrafo': ('Se colaboró en la revisión y actualización de comprobantes y soportes '
            'contables del período, contribuyendo a mantener la correlatividad de los registros y '
            'el orden del archivo mientras el equipo se abocaba a las sesiones de levantamiento de '
            'requerimientos.'),
        'investigacion': ('Definición de requerimientos de información y mapeo documental.'),
        'investigacion_parrafo': ('El trabajo se orientó a definir los requerimientos de información '
            'del área mediante reuniones con el personal responsable de la contabilidad. Estas '
            'sesiones permitieron catalogar los datos esenciales y las variables que deben '
            'registrarse de forma obligatoria en el sistema. Asimismo, se mapeó el recorrido '
            'documental de los procesos administrativos, identificando los estados '
            'procedimentales por los que transitan los reportes. Esta labor sirvió para establecer '
            'el esquema unificado de datos y permitió consolidar el diagrama de Gantt que guiaría '
            'las 10 semanas del proyecto.'),
    },
    {
        'semana': 4,
        'operativa': ('Organización y clasificación de expedientes físicos y digitales.'),
        'operativa_parrafo': ('El pasante organizó y clasificó los soportes del departamento para '
            'asegurar la secuencia numérica y cronológica de los registros internos, '
            'restableciendo el control correlativo del archivo documental.'),
        'investigacion': ('Modelado del flujo de asientos contables y estructuración inicial de la '
            'base de datos.'),
        'investigacion_parrafo': ('A la par de esta reorganización, se profundizó en el estudio del '
            'flujo de los asientos contables mediante entrevistas con el personal, trazando los '
            'diagramas procedimentales que describen el recorrido de los datos y estructurando la '
            'base de datos inicial del sistema de información.'),
    },
    {
        'semana': 5,
        'operativa': ('Definición de políticas de acceso e integridad de los datos del aplicativo.'),
        'operativa_parrafo': ('Junto al equipo administrativo se establecieron los niveles de '
            'restricción para la lectura y modificación de registros según los roles de cada '
            'cargo, alineados con las funciones que cada puesto desempeña dentro del '
            'departamento.'),
        'investigacion': ('Evaluación de un prototipo conceptual de las interfaces.'),
        'investigacion_parrafo': ('En el aspecto tecnológico, se presentó un prototipo conceptual de '
            'las interfaces ante los analistas del área para evaluar su adaptación a las rutinas '
            'diarias de trabajo. La presentación permitió recoger sugerencias directas sobre la '
            'distribución de las opciones de navegación y la carga de datos.'),
    },
    {
        'semana': 6,
        'operativa': ('Apoyo en la carga y verificación de asientos contables del departamento.'),
        'operativa_parrafo': ('Se brindó apoyo operativo en la carga y verificación de asientos y '
            'registros contables del período, confirmando la consistencia de los datos procesados '
            'y liberando al personal para las tareas de validación del aplicativo.'),
        'investigacion': ('Programación e integración de los módulos clave del sistema.'),
        'investigacion_parrafo': ('El trabajo se concentró en la programación e integración técnica '
            'de las funciones clave del sistema de información contable. Se desarrollaron los '
            'módulos capaces de procesar la entrada de datos, ubicar registros históricos y '
            'generar filtros de búsqueda estructurados. El cierre del desarrollo semanal incluyó '
            'pruebas de comunicación entre la base de datos y la interfaz de usuario, verificando '
            'la estabilidad de los componentes integrados mediante ensayos técnicos.'),
    },
    {
        'semana': 7,
        'operativa': ('Archivo correlativo y asistencia en los cierres de información de la '
            'unidad.'),
        'operativa_parrafo': ('Las actividades abarcaron el archivo correlativo de los '
            'comprobantes y la asistencia directa en los cierres de información del '
            'departamento, garantizando la trazabilidad de los registros procesados durante el '
            'período.'),
        'investigacion': ('Preparación de la migración de datos y avance del informe de '
            'pasantías.'),
        'investigacion_parrafo': ('En el ámbito del proyecto, se brindó orientación preliminar al '
            'personal sobre los criterios estandarizados que requeriría el nuevo aplicativo, '
            'preparando el terreno para la migración de datos. Asimismo, se estructuró el avance '
            'del primer capítulo del informe de pasantías y se elaboró el resumen consolidado de '
            'las actividades operativas realizadas hasta la fecha.'),
    },
    {
        'semana': 8,
        'operativa': ('Consolidación de reportes y estatus de expedientes solicitados por la '
            'gerencia.'),
        'operativa_parrafo': ('Se llevó a cabo la síntesis y revisión del estatus de los '
            'expedientes contables solicitados por la gerencia, asegurando la actualización de '
            'los resúmenes y la disponibilidad oportuna de la información.'),
        'investigacion': ('Pruebas piloto de usabilidad del sistema propuesto.'),
        'investigacion_parrafo': ('Se iniciaron las pruebas piloto de uso del sistema de '
            'información contable junto con el personal del departamento. Durante estos ensayos, '
            'se evaluó el desempeño de la herramienta, registrando la retroalimentación y '
            'sugerencias de los usuarios para realizar las optimizaciones pertinentes.'),
    },
    {
        'semana': 9,
        'operativa': ('Consolidación de resúmenes y reportes de cierre del departamento.'),
        'operativa_parrafo': ('Se colaboró en la elaboración y verificación de los resúmenes y '
            'reportes de cierre solicitados por la unidad, garantizando el orden del archivo '
            'físico y digital mientras se documentaba el sistema.'),
        'investigacion': ('Depuración y optimización del sistema según los resultados de las '
            'pruebas piloto.'),
        'investigacion_parrafo': ('Las labores se enfocaron en la depuración y corrección del '
            'sistema en base a los resultados obtenidos en las pruebas piloto de la semana '
            'anterior. Se ajustaron módulos de consulta, se optimizaron los tiempos de respuesta '
            'del aplicativo y se perfeccionaron detalles visuales en la interfaz gráfica para '
            'maximizar la comodidad del usuario. De forma complementaria, se inició la redacción '
            'de los manuales técnicos y de usuario, asegurando que el departamento cuente con la '
            'documentación necesaria para operar el sistema de manera independiente.'),
    },
    {
        'semana': 10,
        'operativa': ('Cierre y entrega del puesto de trabajo.'),
        'operativa_parrafo': ('Se organizó la entrega del puesto de trabajo, concluyendo con éxito '
            'el cronograma establecido y procediendo a la firma de las actas de evaluación y '
            'culminación de las pasantías.'),
        'investigacion': ('Entrega oficial del proyecto y capacitación final.'),
        'investigacion_parrafo': ('Se llevó a cabo la presentación oficial y entrega del proyecto '
            'de sistema de información contable ante el tutor industrial y los miembros del '
            'departamento Administrativo/Contable. Se distribuyeron los manuales de usuario y se '
            'realizó una última jornada de capacitación para aclarar dudas sobre el '
            'funcionamiento integral del software.'),
    },
]

# ========================================================================
# 8. CAPÍTULO V — CONCLUSIONES Y RECOMENDACIONES (pendiente)
# ========================================================================
CONCLUSIONES_INTRO = ('El desarrollo del período de pasantías profesionales en el departamento '
 'Administrativo/Contable de la empresa H & M Grupo Empresarial C.A. permitió cumplir '
 'satisfactoriamente con cada uno de los objetivos específicos planteados, tal como se '
 'evidencia en las siguientes conclusiones:')

CONCLUSIONES = [
    ('A través del diagnóstico situacional se logró determinar que el departamento '
     'Administrativo/Contable no disponía de un sistema de información integrado para el '
     'registro de las operaciones, pues los datos financieros se procesaban de forma manual '
     'mediante planillas y aplicaciones de oficina. Esta situación provocaba duplicidad de '
     'registros, demora en la generación de los reportes y una mayor exposición a errores al '
     'momento de preparar las declaraciones y cumplir con los deberes formales establecidos '
     'por la normativa fiscal, lo que justificó la elaboración de la propuesta.'),
    ('La recolección de requerimientos, realizada mediante entrevistas al personal (Lcda. '
     'Marta Rojas y Diego Aray), la observación directa y el análisis de los procedimientos, '
     'permitió identificar las actividades críticas del departamento y las necesidades '
     'exactas de información, garantizando que la solución propuesta respondiera a la '
     'realidad operativa de la empresa y no a supuestos teóricos.'),
    ('El diseño del sistema de información contable, de carácter modular e integrado, se '
     'elaboró bajo la metodología de desarrollo de sistemas de Kendall y Kendall, aplicando '
     'modelos de datos Entidad-Relación, diagramas de flujo de datos y diagramas UML. Esta '
     'estructura permitió articular los módulos de facturación, ventas, inventario y '
     'contabilidad en un solo entorno, evitando la duplicidad de datos y agilizando el '
     'registro contable desde una única entrada de información.'),
    ('La elaboración del prototipo de las interfaces y su presentación ante el personal del '
     'departamento validaron la usabilidad de la propuesta; la retroalimentación obtenida '
     'durante las pruebas piloto se incorporó al producto final, lo que permitió ajustar '
     'módulos de consulta, optimizar los tiempos de respuesta y perfeccionar los detalles '
     'visuales del aplicativo conforme a las expectativas de los usuarios.'),
    ('La validación de la factibilidad del sistema contable modular confirmó que la '
     'herramienta automatiza los registros financieros, permite el control de los impuestos y '
     'deberes formales de la organización y reduce el tiempo empleado en la elaboración de '
     'resúmenes y reportes. Los resultados obtenidos en las pruebas unitarias y de integración '
     'demostraron que la solución es viable desde el punto de vista operativo, técnico y '
     'económico para la H & M Grupo Empresarial C.A.'),
    ('Finalmente, la realización de las pasantías representó un espacio de crecimiento '
     'profesional y personal, pues permitió aplicar los conocimientos adquiridos durante la '
     'carrera de TSU en Informática en un entorno real, fortaleciendo competencias técnicas, '
     'organizativas y de trabajo en equipo que serán de gran utilidad en el ejercicio futuro '
     'de la profesión.'),
]

RECOMENDACIONES = {
    'intro': ('A partir de las conclusiones obtenidas durante la ejecución de las pasantías, '
     'se formulan las siguientes recomendaciones estratégicas para asegurar la sostenibilidad '
     'de los logros alcanzados:'),
    'secciones': [
        {
            'titulo': 'Para la Empresa',
            'items': [
                ('Continuar con la implementación y el uso del sistema contable, migrando de '
                 'forma progresiva los registros históricos pendientes para consolidar un único '
                 'medio de información financiera.'),
                ('Designar a un responsable del sistema y establecer una rutina de respaldos '
                 'periódicos de los datos, con el fin de proteger la información ante cualquier '
                 'eventualidad.'),
                ('Impartir capacitaciones periódicas al personal del departamento '
                 'Administrativo/Contable y extender la herramienta a las demás unidades de la '
                 'organización (hotel, motel, restaurante y parque recreacional) para unificar '
                 'los procesos.'),
                ('Definir políticas de acceso e integridad de los datos, así como controles '
                 'internos que garanticen la confidencialidad y el correcto cumplimiento de los '
                 'deberes formales.'),
            ],
        },
        {
            'titulo': 'Para el IUTECP',
            'items': [
                ('Fortalecer los convenios con empresas como la H & M Grupo Empresarial C.A. '
                 'para garantizar que los estudiantes realicen sus pasantías en escenarios '
                 'reales donde puedan aplicar sus conocimientos.'),
                ('Actualizar los contenidos curriculares de la especialidad de Informática '
                 'incluyendo herramientas de sistemas de información contable y metodologías de '
                 'ingeniería de requerimientos, como las de Kendall y Kendall.'),
                ('Promover talleres y seminarios sobre sistemas de información, gestión de '
                 'datos financieros y cumplimiento de los deberes formales, en articulación con '
                 'el sector empresarial de la región.'),
                ('Realizar un seguimiento a la inserción laboral de los pasantes a fin de '
                 'evaluar el impacto del programa en la formación técnica de los egresados.'),
            ],
        },
        {
            'titulo': 'Para los Futuros Pasantes',
            'items': [
                ('Asistir a las pasantías con dominio de herramientas de oficina, bases de '
                 'datos y fundamentos de análisis de sistemas, que faciliten el levantamiento y '
                 'la documentación de los procesos.'),
                ('Planificar el trabajo mediante cronogramas de actividades (como el diagrama '
                 'de Gantt) y llevar un registro ordenado de las tareas ejecutadas semana a '
                 'semana.'),
                ('Levantar los requerimientos de forma formal, documentar cada fase del '
                 'proyecto y aprovechar al máximo la orientación de los tutores industrial y '
                 'académico.'),
                ('Mostrar disposición, responsabilidad y compromiso con el puesto asignado, '
                 'cualidades que resultan determinantes para culminar con éxito la práctica '
                 'profesional y el informe final.'),
            ],
        },
    ],
}

# ========================================================================
# 9. REFERENCIAS (pendiente: anexos)
# ========================================================================
REFERENCIAS_LISTA = [
    'Catacora, F. (1998). Sistemas y procedimientos contables. Red Contable C.A.',
    'Dumas, M., La Rosa, M., Mendling, J., & Reijers, H. A. (2018). Fundamentals of Business Process Management (2nd ed.). Springer.',
    'Elmasri, R., & Navathe, S. B. (2007). Fundamentos de sistemas de bases de datos (5.ª ed.). Pearson Educación.',
    'Estupiñán Gaitán, R. (2015). Control interno y fraudes: Análisis de informe COSO I y II con base en los ciclos transaccionales (3.ª ed.). Ecoe Ediciones.',
    'Horngren, C. T., Sundem, G. L., & Elliott, J. A. (2000). Introducción a la contabilidad financiera (7.ª ed.). Pearson Educación.',
    'Kendall, K. E., & Kendall, J. E. (2011). Análisis y diseño de sistemas (8.ª ed.). Pearson Educación.',
    'Moya Millán, E. J. (2006). Elementos de derecho tributario venezolano. Mobil Libros.',
    'Myers, G. J., Badgett, T., & Thomas, C. (2011). The Art of Software Testing (3.ª ed.). John Wiley & Sons.',
    'Nielsen, J. (2000). Usabilidad: diseño de páginas web. Anaya Multimedia.',
    'O\'Brien, J. A., & Marakas, G. M. (2006). Sistemas de información gerencial (7.ª ed.). McGraw-Hill.',
    'Sommerville, I. (2011). Ingeniería de software (9.ª ed.). Pearson Educación.',
    'Whitten, J. L., & Bentley, L. D. (2008). Análisis de sistemas: diseño y métodos (7.ª ed.). McGraw-Hill Interamericana.',
]

ANEXOS_LISTA = []