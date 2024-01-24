import { DevTools } from '@tbdex/http-client'

import fetch from 'node-fetch'
import Papa from 'papaparse'
import fuzzysort from 'fuzzysort'

import fs from 'fs/promises'


export async function createOrLoadDid(filename: string) {
  // Check if the file exists
  try {
    const data = await fs.readFile(filename, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    // If the file doesn't exist, generate a new DID
    if (error.code === 'ENOENT') {
      const did = await DevTools.createDid()
      await fs.writeFile(filename, JSON.stringify(did, null, 2))
      return did
    }
    console.error('Error reading from file:', error)
  }
}


// load issuer's did from a file called issuer-did.txt
const issuer = await createOrLoadDid('issuer.json')
// wtite issuer did to file so server can trust it:

await fs.writeFile('issuer-did.txt', issuer.did)

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


function searchSanctions(queryData: QueryData, data: SanctionEntry[]): SanctionEntry[] {
  const nameResults = fuzzysort.go(queryData.name, data, { key: 'name' })
  let results = nameResults.map(result => result.obj)

  if (queryData.country) {
    const countryResults = fuzzysort.go(queryData.country, data, { key: 'country' })
    const countryMatched = countryResults.map(result => result.obj)
    results = results.filter(entry => countryMatched.includes(entry))
  }

  // Apply minimum score filter
  results = results.filter(result => {
    const nameScore = fuzzysort.single(queryData.name, result.name)?.score ?? -Infinity
    const countryScore = queryData.country ? (fuzzysort.single(queryData.country, result.country)?.score ?? -Infinity) : 0
    return nameScore >= queryData.minScore || countryScore >= queryData.minScore
  })

  return results
}

/*
 * Check if the person is sanctioned and if not - issue them a VC signed by the issuer.
 */
export async function requestCredential(name: string, country: string, customerDid: string) {
  const sanctionsSearch = searchSanctions({
    name: name,
    minScore: 80,
    country: country
  }, sanctionsData)

  if (sanctionsSearch.length > 0) {
    console.log('we have a naughty person, we cannot do business with them')
    return false
  }


  //
  // Create a sanctions credential so that the PFI knows that Alice is legit.
  //
  const { signedCredential } = await DevTools.createCredential({
    type    : 'SanctionCredential',
    issuer  : issuer,
    subject : customerDid,
    data    : {
      'beep': 'boop'
    }
  })

  return signedCredential

}




