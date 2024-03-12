import type { PoolConfig } from 'pg'

import type { LogLevelDesc } from 'loglevel'
import fs from 'fs/promises'

import 'dotenv/config'

import { BearerDid, DidDht, PortableDid } from '@web5/dids'


export type Environment = 'local' | 'staging' | 'production'

export type Config = {
  env: Environment;
  logLevel: LogLevelDesc;
  host: string;
  port: number;
  db: PoolConfig;
  pfiDid: BearerDid;
  allowlist: string[];
  pinPaymentsKey: string;
}

export const config: Config = {
  env: (process.env['ENV'] as Environment) || 'local',
  logLevel: (process.env['LOG_LEVEL'] as LogLevelDesc) || 'info',
  host: process.env['HOST'] || 'http://localhost:9000',
  port: parseInt(process.env['PORT'] || '9000'),
  db: {
    host: process.env['SEC_DB_HOST'] || 'localhost',
    port: parseInt(process.env['SEC_DB_PORT'] || '5432'),
    user: process.env['SEC_DB_USER'] || 'postgres',
    password: process.env['SEC_DB_PASSWORD'] || 'tbd',
    database: process.env['SEC_DB_NAME'] || 'mockpfi',
  },
  pfiDid: await createOrLoadDid('pfi.json'),
  pinPaymentsKey: process.env['SEC_PIN_PAYMENTS_SECRET_KEY'],
  allowlist: JSON.parse(process.env['SEC_ALLOWLISTED_DIDS'] || '[]'),
}




async function createOrLoadDid(filename: string): Promise<BearerDid> {
  // Check if the file exists
  try {
    const data = await fs.readFile(filename, 'utf-8')
    const portableDid: PortableDid = JSON.parse(data)
    const bearerDid = await DidDht.import({ portableDid })
    return bearerDid
  } catch (error) {
    // If the file doesn't exist, generate a new DID
    if (error.code === 'ENOENT') {
      console.log('Creating new did for server...')
      const bearerDid = await DidDht.create({
        options: {
          services: [
            {
              id: 'pfi',
              type: 'PFI',
              serviceEndpoint: process.env['HOST'] || 'http://localhost:9000',
            },
          ],
        },
      })
      const portableDid = await bearerDid.export()
      await fs.writeFile(filename, JSON.stringify(portableDid, null, 2))
      return bearerDid
    }
    console.error('Error reading from file:', error)
  }
}