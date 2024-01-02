import { createOrLoadDid } from './utils.js'

//
// We need to create an issuer, which will issue VCs to the customer, and is trusted by the PFI.
//
const issuer = await createOrLoadDid('issuer.json')
console.log('\nIssuer did:', issuer.did)

// wtite issuer did to file
import fs from 'fs/promises'
await fs.writeFile('issuer-did.txt', issuer.did)
console.log('This did (stored in issuer-did.txt) will be trusted by the PFI.')




