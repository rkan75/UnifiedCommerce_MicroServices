import { retrieveCustomer } from "@lib/data/customer"
import { Toaster } from "@medusajs/ui"
import AccountLayout from "@modules/account/templates/account-layout"
import AccountSlotContent from "@modules/account/components/account-slot-content"

export default async function AccountPageLayout({
  children,
  dashboard,
  login,
}: {
  children?: React.ReactNode
  dashboard?: React.ReactNode
  login?: React.ReactNode
}) {
  const customer = await retrieveCustomer().catch(() => null)

  return (
    <AccountLayout customer={customer}>
      <AccountSlotContent
        customer={!!customer}
        dashboard={dashboard}
        login={login}
        children={children}
      />
      <Toaster />
    </AccountLayout>
  )
}
