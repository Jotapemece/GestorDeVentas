# -*- coding: utf-8 -*-
"""Contenido del caso clínico: Lúes Connatal.

Fuente: trabajo/caso.pdf — se transcribe tal cual, sin modificar información.
Estructura: ESTRUCTURA definida al final de caso.pdf
Portada: formato de trabajo/estructuracaso.pdf
"""

# ===================== PORTADA =====================
PORTADA = {
    'institucion': [
        'República Bolivariana de Venezuela',
        'Ministerio del Poder Popular para la Educación Universitaria',
        'Instituto Universitario de Tecnología',
        '"Elías Calixto Pompa"',
        'El Tigre – Anzoátegui',
    ],
    'titulo': (
        'Proceso de Atención de Enfermería Aplicado a Recién Nacido a Término con '
        'Diagnóstico de Lúes Connatal Ubicado en la Unidad de Retén / Neonatología del '
        'Hospital Dr. Felipe Guevara Rojas en el Mes de Agosto - Septiembre de 2026'
    ),
    'tutor': 'Lcdo. Albys Figueroa',
    'autores': [
        'Alrifai, Amani 31.985.794',
        'Alrifaie, Duaá 32.311.890',
        'Duerto, Raquel 32.840.310',
        'Horvarth, Ariadna 32.826.815',
        'Serra, Ashli 33.431.359',
        'Rodriguez, Valentina 30.230.010',
    ],
    'fecha': 'Septiembre de 2026',
}

# ===================== PÁGINAS PRELIMINARES =====================
AGRADECIMIENTOS = []

DEDICATORIA = []

# ===================== INTRODUCCIÓN =====================
INTRODUCCION = []

# ===================== OBJETIVOS =====================
OBJETIVO_GENERAL = (
    'Aplicar el Proceso de Atención de Enfermería (PAE) en el recién nacido Liam Emanuel '
    'Capriles con diagnóstico de Lúes connatal y sepsis neonatal precoz, hospitalizado en el '
    'servicio de Retén / Neonatología, para restaurar su estado de salud y prevenir '
    'complicaciones mediante intervenciones de enfermería jerarquizadas.'
)

OBJETIVOS_ESPECIFICOS = [
    'Valorar al recién nacido recopilando datos objetivos, anamnesis materna y resultados paraclínicos (hematología completa, procalcitonina y VDRL).',
    'Identificar los patrones funcionales de Marjory Gordon que se encuentran alterados.',
    'Formular los diagnósticos de enfermería (reales y de riesgo) jerarquizados según las necesidades prioritarias del recién nacido.',
    'Planificar y ejecutar las intervenciones de enfermería enfocadas en el esquema terapéutico prescrito (Penicilina Cristalina y Cefotaxima).',
    'Evaluar la evolución clínica del paciente durante su estancia hospitalaria.',
]

# ===================== HISTORIA CLÍNICA DE ENFERMERÍA =====================
HISTORIA_CLINICA = [
    'Nombre del Paciente: Liam Emanuel Capriles',
    'Fecha de Nacimiento: 31-07-2026 (Hora: 9:07 pm)',
    'Edad: 5 días de nacido',
    'Sexo: Masculino',
    'Cédula de Identidad: 31.741.479 (asignada)',
    'Historia Clínica (HC): 31-91-52',
    'Certificado de Nacimiento: 12388442',
    'Datos Antropométricos: Peso al nacer: 3.300 kg | Talla: 50 cm | CC: 36 cm | CT: 33 cm | CA: 32 cm',
    'Madre: Lisneidys Capriles (27 años) | Tlf: 04164906479',
    'Dirección: C/ Brisas del Valle s/n, Sector Nueva Esperanza - El Tigrito, Municipio Guanipa, Estado Anzoátegui.',
    'Servicio: Retén / Neonatología',
]

# ===================== RESUMEN DEL CASO Y ENFERMEDAD ACTUAL =====================
RESUMEN_CASO = [
    'Se trata de recién nacido masculino de 39 semanas de gestación por Ballard (RNAT / AEG), obtenido por cesárea segmentaria el 31/07/2026 a las 9:07 pm. Producto de madre de 27 años de edad, IV gestación, con embarazo mal controlado (1 control prenatal). Como antecedentes maternos destaca VDRL 1/8 en II trimestre no tratado, vaginosis en I trimestre tratada con óvulos de Clinfol por 7 días, niega ITU y HIV (-).',
    'Al nacer, el producto lloró y respiró espontáneamente; se le realizó aseo, colocación de clamp umbilical, administración de Vitamina K, gotas oftálmicas y vacuna anti-Hepatitis B. Es evaluado por el servicio de Pediatría e ingresado al servicio de Retén por antecedentes maternos patológicos (VDRL materno positivo no tratado) con diagnósticos de Lúes connatal A/D y Sepsis neonatal precoz A/D.',
    'A los 5 días de evolución hospitalaria (05/08/2026), el recién nacido se encuentra en cuna en regulares condiciones generales, activo, afebril al tacto, tolerando vía oral, con llanto fuerte, tono muscular conservado y vía periférica permeable para cumplimiento de esquema antibiótico.',
]

# ===================== EXÁMENES DE LABORATORIO Y PARACLÍNICOS =====================
EXAMENES_LABORATORIO = [
    'Hematología Completa (04/08/2026):',
    'Leucocitos: 9.400 /mm³ | VAN: 5.734 /mm³',
    'Eritrocitos: 3,93 /mm³',
    'Hemoglobina: 15,1 g/dL | Hematocrito: 45 %',
    'VCM: 114,5 fL | HCM: 38,4 pg | CHCM: 33,5 %',
    'Segmentados / Neutrófilos: 61 % | Linfocitos: 31 % | MID%: 8 %',
    'Plaquetas: 168.000 /mm³ | VPM: 10,0 fL',
    'Gota Gruesa / Extendido: Negativo (no se observaron formas compatibles con Plasmodium spp.).',
    'Quimioluminiscencia: Procalcitonina (04/08/2026): 0,82 ng/mL (Posible infección / infección sistémica).',
    'Inmunología: VDRL: Reactivo 1/4 (02/08/2026).',
]

# ===================== DIAGNÓSTICO MÉDICO =====================
DX_MEDICO = [
    '1. Recién Nacido a Término (39 semanas por Ballard) / Adecuado para la Edad Gestacional (RNAT / AEG)',
    '¿Qué es?: Condición del neonato nacido entre las semanas 37 y 41 de gestación cuyo peso al nacer (3.300 kg) se ubica dentro del rango esperado para su edad gestacional.',
    '¿Qué afecta?: Representa un factor protector. Indica que el neonato completó su maduración física y neurológica en el útero, lo que le otorga una mejor capacidad de adaptación a la vida extrauterina en comparación con un prematuro.',
    '2. Lúes Connatal (Sífilis Congénita) A/D',
    '¿Qué es?: Infección de transmisión vertical en la que la bacteria Treponema pallidum se transmite de la madre infectada (con antecedente de VDRL 1/8 no tratado) al recién nacido durante la gestación.',
    '¿Qué afecta?: Afecta la salud general del neonato al ponerlo en riesgo de desarrollar alteraciones multiorgánicas (cutáneas, óseas, hepáticas y neurológicas). En este paciente, el hallazgo de VDRL reactivo (1/4) exige la administración inmediata del esquema completo de Penicilina Cristalina para eliminar el microorganismo y prevenir secuelas a largo plazo.',
    '3. Sepsis Neonatal Precoz A/D',
    '¿Qué es?: Síndrome de respuesta inflamatoria sistémica que se presenta en las primeras 72 horas de vida, secundario a la exposición del recién nacido a microorganismos patógenos en el canal del parto o antecedentes infecciosos maternos (vaginosis bacteriana y embarazo mal controlado).',
    '¿Qué afecta?: Afecta la estabilidad hemodinámica y el estado inmunológico del lactante, comprometiendo su bienestar general. Se evidencia por la elevación de la procalcitonina (0,82 ng/mL) e hipotermia leve (34.8 °C), requiriendo tratamiento antibiótico de amplio espectro (Cefotaxima) y monitorización continua para evitar una falla multiorgánica.',
]

# ===================== ANTECEDENTES PERSONALES PATOLÓGICOS =====================
ANTECEDENTES = [
    'Antecedentes Maternos: IV gestación, embarazo mal controlado (1 control). VDRL 1/8 en II trimestre no tratado, HIV (-) (23/07/26). Vaginosis bacteriana en I trimestre tratada con óvulos de Clinfol por 7 días. Niega ITU.',
    'Antecedentes Perinatales: Nacido el 31/07/2026 a las 9:07 pm por cesárea segmentaria. Peso: 3.300 kg, Talla: 50 cm. Lloró y respiró al nacer. Profilaxis neonatal cumplida (Vitamina K, gotas oftálmicas y vacuna Hepatitis B).',
]

# ===================== EXAMEN FÍSICO (CEFALOCAUDAL) =====================
EXAMEN_FISICO = [
    '(Información tomada de la historia clínica)',
    'Signos Vitales: FC: 129 bpm | FR: 31 rpm | Temp: 34.8 °C',
    'Piel: Tez sonrosada, normotérmica, turgor y elasticidad conservada, llenado capilar < 3 segundos.',
    'Cabeza y Cara: Normocéfalo, fontanelas normotensas. Ojos simétricos, isocóricos. Oídos con pabellón auricular normoimplantado. Nariz con narinas permeables. Boca con mucosa húmeda y paladar indemne.',
    'Cardiopulmonar: Tórax simétrico, normoexpansible. Ruidos respiratorios presentes sin agregados. Ruidos cardíacos rítmicos y regulares.',
    'Abdomen: Batracoide, blando, depresible, no doloroso a la palpación. RHA presentes.',
    'Anogenital: Genitales normoconfigurados, ano permeable.',
    'Extremidades: Simétricas, eutróficas, sin edemas.',
    'Neurológico: Vigil, activo, llanto fuerte, succión adecuada, tono muscular conservado.',
]

# ===================== PATRONES FUNCIONALES DE MARJORY GORDON (ALTERADOS) =====================
PATRONES_GORDON = [
    '1. Patrón 1: Percepción - Manejo de la Salud: Alterado por proceso infeccioso activo (Lúes connatal A/D) y riesgo de sepsis neonatal precoz secundario a antecedente materno de VDRL (+) no tratado durante la gestación.',
    '2. Patrón 2: Nutricional - Metabólico: Riesgo de alteración secundario al cumplimiento de tratamiento antibiótico endovenoso y monitoreo de la tolerancia de la vía oral.',
]

# ===================== PLAN DE CUIDADOS E INTERVENCIONES DE ENFERMERÍA =====================
PLAN_CUIDADOS = [
    '1. Protección ineficaz R/C respuesta inmune inmadura y transmisión vertical infecciosa E/P VDRL reactivo (1/4) y diagnóstico de Lúes connatal.',
    'Objetivo: El recién nacido mantendrá la infección controlada sin signos de deterioro sistémico.',
    'Intervenciones:',
    'Administración de Penicilina Cristalina (150.000 UI/kg/día = 247.000 UI) VEV c/12h.',
    'Administración de Cefotaxima (150 mg/kg/día = 247 mg) VEV c/12h.',
    'Monitorear la respuesta al tratamiento antibiótico y vigilar signos de reacción adversa.',
    '2. Riesgo de infección sistémica R/C susceptibilidad del recién nacido a la diseminación bacteriana (sepsis neonatal precoz).',
    'Objetivo: Prevenir la progresión a sepsis severa durante la estancia en el servicio de Retén.',
    'Intervenciones:',
    'Mantener estricta técnica aséptica en el manejo y canalización de la vía venosa periférica.',
    'Evaluar periódicamente los reportes de laboratorio (Leucocitos: 9.400 /mm³, Procalcitonina: 0,82 ng/mL).',
    'Vigilar presencia de signos de alarma (hipotermia, letargia, llenado capilar lento).',
    '3. Riesgo de alteración de la temperatura corporal R/C inmadurez del centro termorregulador e hipotermia leve registrada (34.8 °C).',
    'Objetivo: Restablecer y mantener la normotermia (36.5 °C - 37.5 °C).',
    'Intervenciones:',
    'Mantener al neonato abrigado en cuna con confort térmico adecuado.',
    'Controlar y registrar la temperatura corporal de forma horaria hasta su estabilización.',
    '4. Riesgo de interrupción de la lactancia materna R/C hospitalización en el servicio de Retén.',
    'Objetivo: Garantizar el mantenimiento de la lactancia materna y una adecuada nutrición.',
    'Intervenciones:',
    'Promover la entrada de la madre para fomentar el amamantamiento y el vínculo afectivo.',
    'Administración de suplementación según esquema médico (Ácido Fólico 0,5 cc VO OD, Henroic 0,5 cc VO OD, Complejo B 0,5 cc VO OD).',
    '5. Disposición para mejorar el conocimiento materno R/C cuidados del neonato y adherencia al tratamiento al alta.',
    'Objetivo: La madre expresará comprensión sobre el manejo y seguimiento de la patología.',
    'Intervenciones:',
    'Orientar a la madre sobre la importancia de completar el tratamiento con Penicilina.',
    'Educar sobre la identificación precoz de signos de alarma (rechazo al alimento, fiebre, somnolencia).',
]

# ===================== CONCLUSIONES Y RECOMENDACIONES (PERSONALES) =====================
CONCLUSIONES = [
    'El abordaje de enfermería en el servicio de Retén es fundamental para la detección e intervención oportuna en recién nacidos expuestos a infecciones de transmisión vertical. La administración rigurosa del tratamiento antibiótico con Penicilina Cristalina y Cefotaxima, sumada a la vigilancia constante de las constantes vitales, permitió mantener la estabilidad clínica del recién nacido Liam Capriles.',
]

RECOMENDACIONES = [
    'Fortalecer las estrategias de control prenatal en el primer nivel de atención para garantizar el despistaje y tratamiento oportuno del VDRL en la embarazada, evitando la transmisión vertical de la sífilis y reduciendo la morbilidad neonatal.',
]

QUE_APRENDI = []
