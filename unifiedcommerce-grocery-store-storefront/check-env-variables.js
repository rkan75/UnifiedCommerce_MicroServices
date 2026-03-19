const c = require("ansi-colors")

const requiredEnvs = [
  {
    key: "NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY",
    description:
      "Set in .env.local. Get the key from your Medusa Admin (e.g. http://localhost:9000/app → Settings → Publishable API Keys). Use a key from the same backend as MEDUSA_BACKEND_URL.",
  },
]

function checkEnvVariables() {
  const missingEnvs = requiredEnvs.filter(function (env) {
    return !process.env[env.key]
  })

  if (missingEnvs.length > 0) {
    console.error(
      c.red.bold("\n🚫 Error: Missing required environment variables\n")
    )

    missingEnvs.forEach(function (env) {
      console.error(c.yellow(`  ${c.bold(env.key)}`))
      if (env.description) {
        console.error(c.dim(`    ${env.description}\n`))
      }
    })

    console.error(
      c.yellow(
        "\nCopy .env.example to .env.local, then set the missing variables. Restart the dev server after changing .env.local.\n"
      )
    )

    process.exit(1)
  }
}

module.exports = checkEnvVariables
