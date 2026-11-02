import { Injectable, OnModuleDestroy } from '@nestjs/common'
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg'

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool

  constructor() {
    if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL')
    const connectionUrl = new URL(process.env.DATABASE_URL)
    // pg puede sobrescribir ssl a partir de la URI; centralizar TLS aquí.
    if (process.env.DATABASE_SSL === 'true') {
      for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) connectionUrl.searchParams.delete(key)
    }
    this.pool = new Pool({
      connectionString: connectionUrl.toString(),
      connectionTimeoutMillis: 10000,
      ssl: process.env.DATABASE_SSL === 'true' ? {
        rejectUnauthorized: true,
        ...(process.env.DATABASE_CA_CERT ? { ca: process.env.DATABASE_CA_CERT.replace(/\\n/g, '\n') } : {}),
      } : undefined,
    })
  }

  query<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    return this.pool.query<T>(sql, params)
  }

  async transaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const result = await operation(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end()
  }
}
