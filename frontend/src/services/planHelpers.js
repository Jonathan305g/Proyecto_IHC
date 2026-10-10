/**
 * Utilidades para serializar, deserializar y validar planes de prueba
 * y tareas dentro del asistente de planes (HU-01 / S2-05).
 */

export const MODALIDADES_DISPONIBLES = [
  'Moderada presencial',
  'Moderada remota',
  'No moderada remota',
  'Mixta (presencial y remota)',
]

export const METRICAS_SUGERIDAS = [
  'Tasa de éxito y tiempo de completación',
  'Eficacia y número de errores cometidos',
  'Escala de facilidad (SEQ) y completitud',
  'Satisfacción del usuario (SUS) y tasa de éxito',
  'Tiempo en tarea y solicitudes de ayuda',
]

/**
 * Serializa los datos generales en un texto legible y estructurado para `objetivo`.
 */
export function serializePlanObjective({ objetivo, interfazEvaluada, perfil, modalidad, numeroParticipantes }) {
  const parts = []
  if (objetivo?.trim()) parts.push(objetivo.trim())
  
  const meta = []
  if (interfazEvaluada?.trim()) meta.push(`Interfaz evaluada: ${interfazEvaluada.trim()}`)
  if (perfil?.trim()) meta.push(`Perfil de participantes: ${perfil.trim()}`)
  if (modalidad?.trim()) meta.push(`Modalidad: ${modalidad.trim()}`)
  if (numeroParticipantes !== undefined && numeroParticipantes !== null && numeroParticipantes !== '') {
    meta.push(`Número previsto de participantes: ${numeroParticipantes}`)
  }

  if (meta.length > 0) {
    parts.push(`\n--- Metadatos del Plan ---\n${meta.join('\n')}`)
  }

  return parts.join('\n')
}

/**
 * Deserializa el texto de `objetivo` para recuperar los campos de datos generales.
 */
export function deserializePlanObjective(rawText = '') {
  if (!rawText) {
    return {
      objetivo: '',
      interfazEvaluada: '',
      perfil: '',
      modalidad: 'Moderada remota',
      numeroParticipantes: '5',
    }
  }

  const separator = '\n--- Metadatos del Plan ---\n'
  if (!rawText.includes(separator)) {
    // Si no contiene el separador, intentar buscar líneas de metadatos o dejarlo como objetivo puro
    return {
      objetivo: rawText.trim(),
      interfazEvaluada: '',
      perfil: '',
      modalidad: 'Moderada remota',
      numeroParticipantes: '5',
    }
  }

  const [mainObjective, metadataBlock] = rawText.split(separator)
  const metaLines = (metadataBlock || '').split('\n')

  let interfazEvaluada = ''
  let perfil = ''
  let modalidad = 'Moderada remota'
  let numeroParticipantes = '5'

  for (const line of metaLines) {
    if (line.startsWith('Interfaz evaluada: ')) {
      interfazEvaluada = line.replace('Interfaz evaluada: ', '').trim()
    } else if (line.startsWith('Perfil de participantes: ')) {
      perfil = line.replace('Perfil de participantes: ', '').trim()
    } else if (line.startsWith('Modalidad: ')) {
      modalidad = line.replace('Modalidad: ', '').trim()
    } else if (line.startsWith('Número previsto de participantes: ')) {
      numeroParticipantes = line.replace('Número previsto de participantes: ', '').trim()
    }
  }

  return {
    objetivo: (mainObjective || '').trim(),
    interfazEvaluada,
    perfil,
    modalidad: modalidad || 'Moderada remota',
    numeroParticipantes: numeroParticipantes || '5',
  }
}

/**
 * Serializa la consigna, resultado esperado y métrica en `descripcion`.
 */
export function serializeTaskDescription({ consignaNeutral, resultadoEsperado, metrica }) {
  const parts = []
  if (consignaNeutral?.trim()) {
    parts.push(`Consigna neutral:\n${consignaNeutral.trim()}`)
  }
  if (resultadoEsperado?.trim()) {
    parts.push(`Resultado esperado:\n${resultadoEsperado.trim()}`)
  }
  if (metrica?.trim()) {
    parts.push(`Métrica:\n${metrica.trim()}`)
  }
  return parts.join('\n\n')
}

/**
 * Deserializa `descripcion` para recuperar consigna neutral, resultado esperado y métrica.
 */
export function deserializeTaskDescription(rawText = '') {
  if (!rawText) {
    return {
      consignaNeutral: '',
      resultadoEsperado: '',
      metrica: 'Tasa de éxito y tiempo de completación',
    }
  }

  const consignaMatch = rawText.match(/Consigna neutral:\n([\s\S]*?)(?=\n\nResultado esperado:|\n\nMétrica:|$)/)
  const resultadoMatch = rawText.match(/Resultado esperado:\n([\s\S]*?)(?=\n\nMétrica:|$)/)
  const metricaMatch = rawText.match(/Métrica:\n([\s\S]*?)$/)

  if (consignaMatch || resultadoMatch || metricaMatch) {
    return {
      consignaNeutral: consignaMatch ? consignaMatch[1].trim() : '',
      resultadoEsperado: resultadoMatch ? resultadoMatch[1].trim() : '',
      metrica: metricaMatch ? metricaMatch[1].trim() : 'Tasa de éxito y tiempo de completación',
    }
  }

  // Fallback para descripciones clásicas
  return {
    consignaNeutral: rawText.trim(),
    resultadoEsperado: '',
    metrica: 'Tasa de éxito y tiempo de completación',
  }
}

/**
 * Crea una tarea en blanco para el asistente.
 */
export function createBlankTask(index = 0) {
  return {
    codigo: `T-0${index + 1}`,
    titulo: '',
    consignaNeutral: '',
    resultadoEsperado: '',
    metrica: 'Tasa de éxito y tiempo de completación',
    criterioExito: '',
  }
}
