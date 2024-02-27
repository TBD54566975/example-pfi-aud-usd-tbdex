import type { PoolConfig } from "pg";

import type { LogLevelDesc } from "loglevel";
import fs from "node:fs";

import "dotenv/config";

import { BearerDid, DidDht } from "@web5/dids";
import { createOrLoadDid } from "./credential-issuer.js";

export type Environment = "local" | "staging" | "production";

export type Config = {
  env: Environment;
  logLevel: LogLevelDesc;
  host: string;
  port: number;
  db: PoolConfig;
  pfiDid: BearerDid;
  allowlist: string[];
  pinPaymentsKey: string;
};

export const config: Config = {
  env: (process.env["ENV"] as Environment) || "local",
  logLevel: (process.env["LOG_LEVEL"] as LogLevelDesc) || "info",
  host: process.env["HOST"] || "http://localhost:9000",
  port: parseInt(process.env["PORT"] || "9000"),
  db: {
    host: process.env["SEC_DB_HOST"] || "localhost",
    port: parseInt(process.env["SEC_DB_PORT"] || "5432"),
    user: process.env["SEC_DB_USER"] || "postgres",
    password: process.env["SEC_DB_PASSWORD"] || "tbd",
    database: process.env["SEC_DB_NAME"] || "mockpfi",
  },
  pfiDid: await createOrLoadDid("pfi.json"),
  pinPaymentsKey: process.env["SEC_PIN_PAYMENTS_SECRET_KEY"],
  allowlist: JSON.parse(process.env["SEC_ALLOWLISTED_DIDS"] || "[]"),
};

// create ephemeral PFI did if one wasn't provided. Note: this DID and associated keys aren't persisted!
// a new one will be generated every time the process starts.
if (!config.pfiDid) {
  console.log(
    "PFI DID was not loaded from config. Creating an ephemeral PFI DID.....",
  );
  const pfiDid = await DidDht.create({
    options: {
      services: [{ id: "pfi", type: "PFI", serviceEndpoint: config.host }],
    },
  });

  config.pfiDid = pfiDid;
  fs.writeFileSync("pfi.json", JSON.stringify(config.pfiDid, null, 2));
}