import { createApplication } from './application'

async function bootstrap(): Promise<void> {
  const app = await createApplication()
  await app.listen(Number(process.env.PORT ?? 3000))
}

void bootstrap()
