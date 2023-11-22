import './polyfills.js'

import { Postgres, OfferingRepository } from './db/index.js'
import { Offering } from '@tbdex/http-server'
import { config } from './config.js'

await Postgres.connect()
// await Postgres.ping()
await Postgres.clear()

const offering = Offering.create({
  metadata: { from: config.did.id },
  data: {
    description: 'rip off offering USD to AUD',
    payoutUnitsPerPayinUnit: '1.1', // ex. we send 100 dollars, so that means 110 AUD - clearly not a good price!
    payoutCurrency: { currencyCode: 'AUD' },
    payinCurrency: { currencyCode: 'USD' },
    payinMethods: [{
      kind: 'USDC_WALLET',
      requiredPaymentDetails: {}
    }],
    payoutMethods: [
      {
        kind: 'AUSTRALIAN_BANK_ACCOUNT',
        requiredPaymentDetails: {
          '$schema': 'http://json-schema.org/draft-07/schema#',
          'title': 'Australian Bank Account Required Payment Details',
          'type': 'object',
          'required': [
            'accountNumber',
            'bsbNumber', 
            'accountName'
          ],
          'additionalProperties': false,
          'properties': {
            'accountNumber': {
              'title': 'Account Number',
              'description': 'Account Number',
              'type': 'string'
            },
            'bsbNumber': {
              'title': 'BSB Number',
              'description': 'BSB Number',
              'type': 'string'
            }, 
            'accountName': {
              'title': 'Account Name',
              'description': 'Account Name',
              'type': 'string'
            }
          }
        }
      }
    ],
    requiredClaims: {
      id: '7ce4004c-3c38-4853-968b-e411bafcd945',
      input_descriptors: [{
        id: 'bbdb9b7c-5754-4f46-b63b-590bada959e0',
        constraints: {
          fields: [
            {
              path: ['$.type[*]'],
              filter: {
                type: 'string',
                pattern: '^SanctionCredential$'
              }
            }
            // uncommend the following with a valid issuer did from npm run example-create-issuer:
            //,
            //{
            //  path: ['$.issuer'],
            //  filter: {
            //    type: 'string',
            //    const: 'did:key:z6MkrA3GSkK3hxy4oQvezUSwTMR28Y97ZzYLHhBRjySLKfjB'
            //  }
            //}
          ]
        }
      }]
    }
  }
})

await offering.sign(config.did.privateKey, config.did.kid)
await OfferingRepository.create(offering)