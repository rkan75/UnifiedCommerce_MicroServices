/** Minimal line-art shopping cart (outline) for header / nav */
export function CartOutlineIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M2 3h2.5l1.8 11.2a2 2 0 0 0 2 1.68H17.5a2 2 0 0 0 2-1.68L21.5 8H6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="9"
        cy="20"
        r="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <circle
        cx="18"
        cy="20"
        r="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
      />
    </svg>
  )
}
