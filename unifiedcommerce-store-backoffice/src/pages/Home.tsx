import { Container, Heading, Text } from "@medusajs/ui"
import { Link } from "react-router-dom"

export default function HomePage() {
  return (
    <Container className="p-6">
      <Heading level="h1" className="mb-4">
        Grocery Backoffice
      </Heading>
      <Text className="text-ui-fg-subtle mb-6">
        Operations tools for the grocery backend. Use the navigation to open a tool.
      </Text>
      <ul className="list-disc list-inside space-y-2">
        <li>
          <Link to="/order-weight" className="text-ui-fg-interactive hover:underline">
            Order weight adjustment
          </Link>
          — Enter actual weight for sold-by-weight line items and recalculate order totals.
        </li>
      </ul>
    </Container>
  )
}
