#!/usr/bin/env node
/**
 * Prints shell exports for SPRING_DATASOURCE_* from DATABASE_URL (postgresql://...).
 * Handles passwords containing @ (e.g. ...://user:pass@word@host:5432/db).
 */
const u = process.env.DATABASE_URL
if (!u || !u.startsWith("postgresql://")) {
  process.exit(0)
}

const rest = u.slice("postgresql://".length)
const at = rest.lastIndexOf("@")
if (at < 0) process.exit(0)

const creds = rest.slice(0, at)
const hostdb = rest.slice(at + 1)
const slash = hostdb.indexOf("/")
if (slash < 0) process.exit(0)

const hostport = hostdb.slice(0, slash)
let db = hostdb.slice(slash + 1)
const q = db.indexOf("?")
if (q >= 0) db = db.slice(0, q)

const colon = creds.indexOf(":")
if (colon < 0) process.exit(0)
const user = creds.slice(0, colon)
const password = creds.slice(colon + 1)

const hp = hostport.split(":")
const host = hp[0] || "localhost"
const port = hp[1] || "5432"

const jdbc = `jdbc:postgresql://${host}:${port}/${db}`

function shExport(name, value) {
  const s = JSON.stringify(value)
  console.log(`export ${name}=${s}`)
}

shExport("SPRING_DATASOURCE_URL", jdbc)
shExport("SPRING_DATASOURCE_USERNAME", user)
shExport("SPRING_DATASOURCE_PASSWORD", password)
