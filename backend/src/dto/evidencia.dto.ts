import { isUtf8 } from 'node:buffer'
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
  audio: ['.mp3', '.wav', '.ogg', '.m4a', '.webm'],
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

  const mimeByExtension: Record<string, string[]> = {
    '.png': ['image/png'], '.jpg': ['image/jpeg'], '.jpeg': ['image/jpeg'],
    '.webp': ['image/webp'], '.gif': ['image/gif'], '.mp4': ['video/mp4'],
    '.webm': ['video/webm', 'audio/webm'], '.mov': ['video/quicktime'],
    '.mp3': ['audio/mpeg', 'audio/mp3'], '.wav': ['audio/wav'], '.ogg': ['audio/ogg'],
    '.m4a': ['audio/mp4', 'audio/x-m4a'], '.pdf': ['application/pdf'], '.txt': ['text/plain'],
  }
  if (mimeByExtension[ext]?.includes(normalizedMime)) {
    return Object.entries(ALLOWED_MIME_TYPES).find(([, mimes]) => mimes.includes(normalizedMime))![0] as Exclude<TipoEvidencia, 'enlace'>
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
  const bytes = file.buffer
  if (!bytes || bytes.length !== file.size) throw new BadRequestException('El contenido del archivo no coincide con su tamaño.')
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase()
  const ascii = (start: number, end: number) => bytes.toString('ascii', start, end)
  const hex = (size: number) => bytes.subarray(0, size).toString('hex')
  const signatures: Record<string, boolean> = {
    '.png': hex(8) === '89504e470d0a1a0a',
    '.jpg': hex(3) === 'ffd8ff', '.jpeg': hex(3) === 'ffd8ff',
    '.gif': ['GIF87a', 'GIF89a'].includes(ascii(0, 6)),
    '.webp': ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP',
    '.wav': ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WAVE',
    '.pdf': ascii(0, 5) === '%PDF-',
    '.webm': hex(4) === '1a45dfa3', '.ogg': ascii(0, 4) === 'OggS',
    '.mp4': ascii(4, 8) === 'ftyp', '.mov': ascii(4, 8) === 'ftyp', '.m4a': ascii(4, 8) === 'ftyp',
    '.mp3': ascii(0, 3) === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0),
    '.txt': isUtf8(bytes) && !bytes.includes(0),
  }
  if (!signatures[ext]) throw new BadRequestException('El contenido no corresponde al formato declarado.')

  return {
    tipo,
    nombre_archivo: filename,
    tamano_bytes: file.size,
    mime_type: ({ 'audio/mp3': 'audio/mpeg', 'audio/x-m4a': 'audio/mp4' } as Record<string, string>)[file.mimetype] || file.mimetype,
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
  try {
    const parsed = new URL(url)
    if (!parsed.hostname || parsed.username || parsed.password) throw new Error()
  } catch { throw new BadRequestException('La URL del enlace no es válida.') }
  const descripcion = raw.descripcion ? text(raw.descripcion, 'descripcion', 1000) : null
  return {
    tipo: 'enlace',
    ruta: url,
    descripcion,
  }
}
