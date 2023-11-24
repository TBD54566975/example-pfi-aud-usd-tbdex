import { TbdexHttpClient, DevTools, Rfq } from '@tbdex/http-client'
import fs from 'fs/promises'

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
const { data } = await TbdexHttpClient.getOfferings({ pfiDid: PFI_DID })
const [ offering ] = data
//console.log('offering', JSON.stringify(offering, null, 2))

