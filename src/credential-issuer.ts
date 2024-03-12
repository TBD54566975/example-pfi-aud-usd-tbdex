import { BearerDid, DidDht, PortableDid } from '@web5/dids'
import { VerifiableCredential } from '@web5/credentials'

import fetch from 'node-fetch'
import Papa from 'papaparse'
import fuzzysort from 'fuzzysort'

import fs from 'fs/promises'

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
      const bearerDid = await DidDht.create({
      })
      const portableDid = await bearerDid.export()
      await fs.writeFile(filename, JSON.stringify(portableDid, null, 2))
      return bearerDid
    }
    console.error('Error reading from file:', error)
  }
}

// load issuer's did from a file called issuer-did.txt
const issuer: BearerDid = await createOrLoadDid('issuer.json')
// write issuer did to file so server can trust it:
await fs.writeFile('issuer-did.txt', issuer.uri)

type SanctionEntry = {
  name: string;
  country: string;
  // Additional fields can be added as needed
}

type QueryData = {
  name: string;
  minScore: number;
  country?: string;
}

async function loadSanctionsData(): Promise<SanctionEntry[] | null> {
  const url = 'https://www.treasury.gov/ofac/downloads/sdn.csv'
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const text = await response.text()
    const data = Papa.parse<SanctionEntry>(text, { header: true }).data
    return data
  } catch (error) {
    console.error(`Error fetching data: ${error}`)
    return null
  }
}

console.log('Loading OFAC sanctions data...')
let sanctionsData: SanctionEntry[] | null = await loadSanctionsData()

function searchSanctions(
  queryData: QueryData,
  data: SanctionEntry[],
): SanctionEntry[] {
  const nameResults = fuzzysort.go(queryData.name, data, { key: 'name' })
  let results = nameResults.map((result) => result.obj)

  if (queryData.country) {
    const countryResults = fuzzysort.go(queryData.country, data, {
      key: 'country',
    })
    const countryMatched = countryResults.map((result) => result.obj)
    results = results.filter((entry) => countryMatched.includes(entry))
  }

  // Apply minimum score filter
  results = results.filter((result) => {
    const nameScore =
      fuzzysort.single(queryData.name, result.name)?.score ?? -Infinity
    const countryScore = queryData.country
      ? fuzzysort.single(queryData.country, result.country)?.score ?? -Infinity
      : 0
    return (
      nameScore >= queryData.minScore || countryScore >= queryData.minScore
    )
  })

  return results
}

/*
 * Check if the person is sanctioned and if not - issue them a VC signed by the issuer.
 */
export async function requestCredential(
  name: string,
  country: string,
  customerDid: string,
) {
  const sanctionsSearch = searchSanctions(
    {
      name: name,
      minScore: 80,
      country: country,
    },
    sanctionsData,
  )

  if (sanctionsSearch.length > 0) {
    console.log('we have a naughty person, we cannot do business with them')
    return false
  }

  // Create a sanctions credential so that the PFI knows that Alice is legit.
  const vc = await VerifiableCredential.create({
    type: 'SanctionCredential',
    issuer: issuer.uri,
    subject: customerDid,
    data: {
      beep: 'boop',
    },
  })

  const vcJwt = await vc.sign({ did: issuer })

  return vcJwt
}
