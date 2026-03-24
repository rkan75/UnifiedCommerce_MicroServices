import { clx } from "@medusajs/ui"

/**
 * Visual radio indicator only. Must sit inside the real control (e.g. button or
 * Headless UI Radio) so we avoid nested <button> and duplicate radio semantics.
 * Parent should use `className` including `group` so group-hover / group-focus / group-disabled apply.
 */
const Radio = ({ checked, 'data-testid': dataTestId }: { checked: boolean, 'data-testid'?: string }) => {
  return (
    <span
      aria-hidden
      data-state={checked ? "checked" : "unchecked"}
      className="relative flex h-5 w-5 shrink-0 items-center justify-center"
      data-testid={dataTestId || "radio-button"}
    >
      <span
        className={clx(
          "shadow-borders-base flex h-[14px] w-[14px] items-center justify-center rounded-full transition-all group-hover:shadow-borders-strong-with-shadow bg-ui-bg-base group-focus:!shadow-borders-interactive-with-focus group-disabled:!bg-ui-bg-disabled group-disabled:!shadow-borders-base",
          checked && "bg-ui-bg-interactive shadow-borders-interactive"
        )}
      >
        {checked && (
          <span className="flex items-center justify-center">
            <span className="bg-ui-bg-base shadow-details-contrast-on-bg-interactive h-1.5 w-1.5 rounded-full group-disabled:bg-ui-fg-disabled group-disabled:shadow-none" />
          </span>
        )}
      </span>
    </span>
  )
}

export default Radio
