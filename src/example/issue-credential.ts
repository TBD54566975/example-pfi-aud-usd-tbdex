import { DevTools } from '@tbdex/http-client'
import { createOrLoadDid } from './utils.js'
import fs from 'node:fs'


// get the did from the command line parameter
const customerDid = process.argv[2]

const issuer = await createOrLoadDid('issuer.json')

//
// At this point we can check if the user is sanctioned or not and decide to issue the credential.
// TOOD: implement the actual sanctions check!


//
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

console.log('Copy this signed credential for later use:\n\n', signedCredential)
// write to a file
fs.writeFileSync('signed-credential.txt', signedCredential)




