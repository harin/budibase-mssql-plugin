import { IntegrationBase, SqlQuery, Operation } from "@budibase/types"
const sqlServer = require("mssql")


interface MSSQLConfig {
  user: string
  password: string
  server: string
  port: number | string
  database: string
  schema: string
  encrypt?: boolean
  selfSign?: boolean
}


function getSqlQuery(query: SqlQuery | string): SqlQuery {
  if (typeof query === "string") {
    return { sql: query }
  } else {
    return query
  }
}

class CustomIntegration implements IntegrationBase {
  private readonly config: MSSQLConfig
  private client: any
  private index: number = 0
  private readonly pool: any

  constructor(config: MSSQLConfig) {
    this.config = config
    const clientCfg = {
      ...this.config,
      options: {
        encrypt: this.config.encrypt,
        enableArithAbort: true,
        trustServerCertificate: this.config.selfSign
      },
    }

    if (!this.pool) {
      this.pool = new sqlServer.ConnectionPool(clientCfg)
    }
  }
  async internalQuery(
    query: SqlQuery,
    operation: string | undefined = undefined
  ) {
    const client = this.client
    const request = client.request()
    this.index = 0
    try {
      if (Array.isArray(query.bindings)) {
        let count = 0
        for (let binding of query.bindings) {
          request.input(`p${count++}`, binding)
        }
      }
      // this is a hack to get the inserted ID back,
      //  no way to do this with Knex nicely
      const sql =
        operation === Operation.CREATE
          ? `${query.sql}; SELECT SCOPE_IDENTITY() AS id;`
          : query.sql
      return await request.query(sql)
    } catch (err) {
      // @ts-ignore
      throw new Error(err)
    }
  }
  async connect() {
    try {
      this.client = await this.pool.connect()
    } catch (err) {
      // @ts-ignore
      throw new Error(err)
    }
  }
  async read(query: SqlQuery | string) {
    await this.connect()
    const response = await this.internalQuery(getSqlQuery(query))
    return response.recordset
  }

}

export default CustomIntegration
