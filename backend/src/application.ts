import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

/** Configuración compartida entre el servidor y la comprobación integrada real. */
export async function createApplication(logger: false | undefined = undefined) {
  const app = await NestFactory.create(AppModule, { logger })
  app.setGlobalPrefix('api')
  app.enableCors({ origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173' })
  app.enableShutdownHooks()
  app.use((_req: unknown, res: { setHeader(name: string, value: string): void }, next: () => void) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Cache-Control', 'no-store')
    next()
  })
  return app
}
