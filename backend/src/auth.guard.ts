import { CanActivate, ExecutionContext, ForbiddenException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

@Injectable()
export class AuthGuard implements CanActivate {
  private client?: SupabaseClient
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ headers: { authorization?: string } }>()
    const token = /^Bearer (\S+)$/i.exec(request.headers.authorization || '')?.[1]
    if (!token) throw new UnauthorizedException('Inicia sesión para acceder al proyecto.')
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_PUBLISHABLE_KEY
    const allowed = (process.env.AUTH_ALLOWED_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
    if (!url || !key || !allowed.length) throw new ServiceUnavailableException('Falta configurar el acceso del equipo.')
    this.client ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    // Consulta al emisor: no confiar en decodificar un JWT sin verificarlo.
    const { data, error } = await this.client.auth.getUser(token)
    if (error || !data.user) throw new UnauthorizedException('Tu sesión venció. Vuelve a iniciar sesión.')
    if (!data.user.email_confirmed_at || !allowed.includes((data.user.email || '').toLowerCase())) {
      throw new ForbiddenException('Tu cuenta no está autorizada para este equipo.')
    }
    return true
  }
}
