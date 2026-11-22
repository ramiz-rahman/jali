/**
 * A button that is only an icon, drawn as Jali's own header buttons are (`.jali-icon-btn`, a public part): for the
 * app's top bar, a pane's own controls or a sheet's close, so they match the instance in every theme.
 */
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-label" | "children"
> {
  /** What it does, in words: its accessible name, and its tooltip unless `title` gives another. */
  label: string;
  /** The icon, hidden from screen readers (`aria-hidden`), and anything shown after it, such as a `<kbd>`. */
  children: ReactNode;
}

/** `<IconButton label="Copy link" onClick={copy}><LinkIcon size={16} aria-hidden /></IconButton>` */
export const IconButton = /* @__PURE__ */ forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ label, title, className, type = "button", children, ...rest }, ref) {
    return (
      <button
        {...rest}
        ref={ref}
        type={type}
        className={className ? `jali-icon-btn ${className}` : "jali-icon-btn"}
        aria-label={label}
        title={title ?? label}
      >
        {children}
      </button>
    );
  },
);
