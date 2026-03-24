/**
 * Delivery truck in brand red — set `className` to include `text-header-red`.
 */
export function RedDeliveryTruckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path d="M20 8h-3V4H3v13h3c0 1.66 1.34 3 3 3s3-1.34 3-3h4c0 1.66 1.34 3 3 3s3-1.34 3-3h1v-3.68L20 8zm-9 2v3H8v-3h3zm-5 8c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm10 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm3-6h-3V9h3l2 3z" />
    </svg>
  )
}
