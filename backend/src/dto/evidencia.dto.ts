import { BadRequestException } from '@nestjs/common'
import { object, text } from '../validation'

export const MAX_FILE_SIZE = 15 * 1024 * 1024 // 15 MB
export const TIPOS_EVIDENCIA = ['imagen', 'video', 'audio', 'documento', 'enlace'] as const
export type TipoEvidencia = (typeof TIPOS_EVIDENCIA)[number]

export const ALLOWED_MIME_TYPES: Record<Exclude<TipoEvidencia, 'enlace'>, string[]> = {
  imagen: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
  video: ['video/mp4', 'video/webm', 'video/quicktime'],
  audio: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4', 'audio/x-m4a'],
  documento: ['application/pdf', 'text/plain'],
}

export const ALLOWED_EXTENSIONS: Record<Exclude<TipoEvidencia, 'enlace'>, string[]> = {
  imagen: ['.png', '.jpg', '.jpeg', '.webp', '.gif'],
  video: ['.mp4', '.webm', '.mov'],
  audio: ['.mp3', '.wav', '.ogg', '.m4a'],
  documento: ['.pdf', '.txt'],
}

export interface UploadedFileDto {
  fieldname?: string
  originalname: string
  encoding?: string
  mimetype: string
  size: number
  buffer?: Buffer
  path?: string
  filename?: string
}

export interface CreateLinkEvidenceDto {
  tipo: 'enlace'
  ruta: string
  descripcion: string | null
}

export function detectFileType(filename: string, mimetype: string): Exclude<TipoEvidencia, 'enlace'> {
  const ext = (filename.includes('.') ? filename.substring(filename.lastIndexOf('.')).toLowerCase() : '')
  const normalizedMime = (mimetype || '').toLowerCase()

  for (const [category, mimeList] of Object.entries(ALLOWED_MIME_TYPES) as [Exclude<TipoEvidencia, 'enlace'>, string[]][]) {
    const extList = ALLOWED_EXTENSIONS[category]
    if (mimeList.includes(normalizedMime) || extList.includes(ext)) {
      return category
    }
  }

  throw new BadRequestException('Tipo de archivo no admitido.')
}

export function validateUploadedFile(file: UploadedFileDto): {
  tipo: Exclude<TipoEvidencia, 'enlace'>
  nombre_archivo: string
  tamano_bytes: number
  mime_type: string
} {
  if (!file) {
    throw new BadRequestException('No se recibió ningún archivo.')
  }

  if (!file.size || file.size <= 0) {
    throw new BadRequestException('El archivo está vacío.')
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new BadRequestException('El archivo excede el tamaño máximo permitido de 15 MB.')
  }

  const filename = text(file.originalname || 'evidencia', 'nombre_archivo', 255)
  const tipo = detectFileType(filename, file.mimetype)

  return {
    tipo,
    nombre_archivo: filename,
    tamano_bytes: file.size,
    mime_type: file.mimetype || 'application/octet-stream',
  }
}

export function parseLinkEvidence(value: unknown): CreateLinkEvidenceDto {
  const raw = object(value)
  if (raw.tipo !== 'enlace') {
    throw new BadRequestException('El tipo debe ser enlace.')
  }
  const url = text(raw.ruta || raw.url || '', 'URL del enlace', 2048)
  if (!/^https?:\/\//i.test(url)) {
    throw new BadRequestException('La URL debe comenzar con http:// o https://.')
  }
  const descripcion = raw.descripcion ? text(raw.descripcion, 'descripcion', 1000) : null
  return {
    tipo: 'enlace',
    ruta: url,
    descripcion,
  }
}
