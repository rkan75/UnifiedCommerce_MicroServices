/**
 * Brand red “Add to cart” with white label + icons.
 * Use with `<Button variant="primary" />`; `!` utilities beat Medusa primary (often blue) defaults.
 */
export const PRIMARY_ADD_TO_CART_BUTTON_CLASS = [
  "!border-transparent !bg-header-red !text-white shadow-sm",
  "hover:!bg-header-red hover:!text-white hover:!opacity-95",
  "active:!bg-header-red active:!text-white",
  "focus-visible:!outline-none focus-visible:!ring-2 focus-visible:!ring-header-red focus-visible:!ring-offset-2",
  "disabled:!bg-ui-fg-muted disabled:!text-white/90",
  // Icons + nested spans (e.g. loading / gift card layout)
  "[&_svg]:!text-white",
  "[&_span]:!text-white",
].join(" ")
