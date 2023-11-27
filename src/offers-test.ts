import { TbdexHttpClient, DevTools, Rfq } from '@tbdex/http-client'
import fs from 'fs/promises'
import { expect } from 'chai'


//
//
// Replace this with the DID of the PFI you want to connect to.
// Get this from the console of the server once you launch it.
//

// load server-did (this will be created when you run server did, or you can copy/paste one):
let PFI_DID = await fs.readFile('server-did.txt', 'utf-8')


//
//
//  Connect to the PFI and get the list of offerings (offerings are resources - anyone can ask for them)
//
const data = await TbdexHttpClient.getOfferings({ pfiDid: PFI_DID })


// data is a json object with the list of offerings
console.log(data.data.length)
expect(data.data.length).to.be.greaterThan(0)


// now run example create-customer.ts to create a customer DID
// this will create a file called alice-did.txt
