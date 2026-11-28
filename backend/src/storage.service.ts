import { Injectable, ServiceUnavailableException } from '@nestjs/common'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

/** Bucket privado; las claves administrativas nunca llegan a React. */
@Injectable()
export class StorageService {
  private client?: SupabaseClient
  private get bucket() { return process.env.SUPABASE_STORAGE_BUCKET || 'evidencias' }
  private get storage() {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SECRET_KEY
    if (!url || !key) throw new ServiceUnavailableException('Falta configurar el almacenamiento compartido.')
    this.client ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    return this.client.storage.from(this.bucket)
  }
  async upload(key: string, content: Buffer, mime: string) {
    const { error } = await this.storage.upload(key, content, { contentType: mime, upsert: false })
    if (error) throw new ServiceUnavailableException('No se pudo subir la evidencia al almacenamiento compartido.')
  }
  async remove(key: string) {
    const { error } = await this.storage.remove([key])
    if (error) throw new ServiceUnavailableException('No se pudo eliminar el archivo compartido. Reintenta la operación.')
  }
  async sign(key: string, filename = 'evidencia') {
    const { data, error } = await this.storage.createSignedUrl(key, 60, { download: filename })
    if (error || !data) throw new ServiceUnavailableException('No se pudo abrir la evidencia compartida.')
    return data.signedUrl
  }
}
