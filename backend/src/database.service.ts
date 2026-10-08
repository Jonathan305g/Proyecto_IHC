import { Injectable, OnModuleDestroy } from '@nestjs/common'
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg'

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool

  constructor() {
    if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL')
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
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
