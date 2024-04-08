import { OfferingsApi, Offering } from '@tbdex/http-server'
import { config } from './config.js'
import fs from 'fs/promises'

// load issuer's did from a file called issuer-did.txt
const issuer = await fs.readFile('issuer-did.txt', 'utf-8')

const offering = Offering.create({
  metadata: {
    from: config.pfiDid.uri,
  },
  data: {
    description: 'Totes legit USD to AUD liquidity node',
    payoutUnitsPerPayinUnit: '1.1',
    payout: {
      currencyCode: 'AUD',
      methods: [
        {
          kind: 'AUSTRALIAN_BANK_ACCOUNT',
          estimatedSettlementTime: 86400, // 24 hours in seconds
          requiredPaymentDetails: {
            $schema: 'http://json-schema.org/draft-07/schema#',
            title: 'Australian Bank Account Required Payment Details',
            type: 'object',
            required: ['accountNumber', 'bsbNumber', 'accountName'],
            additionalProperties: false,
            properties: {
              accountNumber: {
                title: 'Account Number',
                description: 'Account Number',
                type: 'string',
              },
              bsbNumber: {
                title: 'BSB Number',
                description: 'BSB Number',
                type: 'string',
              },
              accountName: {
                title: 'Account Name',
                description: 'Account Name',
                type: 'string',
              },
            },
          },
        },
      ],
    },
    payin: {
      currencyCode: 'USD',
      methods: [
        {
          kind: 'CREDIT_CARD',
          requiredPaymentDetails: {
            $schema: 'http://json-schema.org/draft-07/schema#',
            title: 'Credit Card',
            type: 'object',
            required: ['cc_number', 'expiry_month', 'expiry_year', 'cvc', 'name'],
            additionalProperties: false,
            properties: {
              cc_number: {
                title: 'credit card number',
                type: 'string',
              },
              expiry_month: {
                title: 'month of expiry',
                type: 'string',
              },
              expiry_year: {
                title: 'year of expiry',
                type: 'string',
              },
              cvc: {
                title: 'security digits',
                type: 'string',
              },
              name: {
                title: 'name on card',
                type: 'string',
              },
            },
          },
        },
      ],
    },
    requiredClaims: {
      id: '7ce4004c-3c38-4853-968b-e411bafcd945',
      input_descriptors: [
        {
          id: 'bbdb9b7c-5754-4f46-b63b-590bada959e0',
          constraints: {
            fields: [
              {
                path: ['$.type[*]'],
                filter: {
                  type: 'string',
                  pattern: '^SanctionCredential$',
                },
              },
              {
                path: ['$.issuer'],
                filter: {
                  type: 'string',
                  const: issuer,
                },
              },
            ],
          },
        },
      ],
    },
  },
})

await offering.sign(config.pfiDid)

// Initialize an array of hardcoded offerings
const hardcodedOfferings: Offering[] = []
hardcodedOfferings.push(offering)

export class HardcodedOfferingRepository implements OfferingsApi {
  // Retrieve a single offering if found
  async getOffering(opts: { id: string }): Promise<Offering | undefined> {
    console.log('call for offerings')
    return hardcodedOfferings.find((offering) => offering.id === opts.id)
  }

  // Retrieve a list of offerings
  async getOfferings(): Promise<Offering[] | undefined> {
    console.log('get all offerings')
    return hardcodedOfferings
  }
}

// Export an instance of the repository
export const OfferingRepository = new HardcodedOfferingRepository()