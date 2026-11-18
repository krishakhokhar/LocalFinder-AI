import { forwardRef } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Loader2 } from "lucide-react";
import useMotionSafe from "../../hooks/useMotionSafe";
import { buttonTap } from "../../utils/motion";

const VARIANTS = {
  primary:
    "bg-brand-600 text-white shadow-soft hover:bg-brand-700 focus-visible:ring-brand-600 disabled:bg-brand-300",
  secondary:
    "bg-brand-50 text-brand-700 hover:bg-brand-100 focus-visible:ring-brand-600 disabled:text-brand-400",
  outline:
    "border border-line bg-surface text-ink-soft hover:border-line-strong hover:bg-slate-50 focus-visible:ring-brand-600",
  ghost: "text-ink-muted hover:bg-slate-100 hover:text-ink focus-visible:ring-brand-600",
  ai: "bg-ai-500 text-white shadow-soft hover:bg-ai-600 focus-visible:ring-ai-500 disabled:bg-ai-200",
  success: "bg-success-500 text-white shadow-soft hover:bg-success-600 focus-visible:ring-success-500",
  danger: "bg-danger-500 text-white shadow-soft hover:bg-danger-600 focus-visible:ring-danger-500",
  dangerGhost: "text-danger-600 hover:bg-danger-50 focus-visible:ring-danger-500",
};

const SIZES = {
  xs: "h-8 px-3 text-xs gap-1.5 rounded-lg",
  sm: "h-9 px-3.5 text-sm gap-1.5 rounded-lg",
  md: "h-11 px-5 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-base gap-2 rounded-xl",
};

/**
 * The only button in the product.
 *
 * Renders as <button>, <a> or react-router <Link> depending on the props,
 * so a link never has to be faked with a click handler. Loading state
 * disables interaction and keeps the label in place, which stops the
 * layout jumping while a request is in flight.
 */
const Button = forwardRef(function Button(
  {
    children,
    variant = "primary",
    size = "md",
    type = "button",
    loading = false,
    disabled = false,
    icon: Icon = null,
    iconRight: IconRight = null,
    fullWidth = false,
    className = "",
    to,
    href,
    ...props
  },
  ref
) {
  const { interaction } = useMotionSafe();
  const isDisabled = disabled || loading;

  const classes = [
    "relative inline-flex select-none items-center justify-center font-semibold transition-colors duration-200",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
    "disabled:cursor-not-allowed disabled:opacity-70",
    VARIANTS[variant] || VARIANTS.primary,
    SIZES[size] || SIZES.md,
    fullWidth ? "w-full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      {loading ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
      ) : Icon ? (
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      ) : null}
      {children}
      {IconRight && !loading ? <IconRight className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
    </>
  );

  const motionProps = interaction(isDisabled ? {} : buttonTap);

  if (to && !isDisabled) {
    return (
      <motion.span {...motionProps} className={fullWidth ? "block w-full" : "inline-block"}>
        <Link ref={ref} to={to} className={classes} {...props}>
          {content}
        </Link>
      </motion.span>
    );
  }

  if (href && !isDisabled) {
    return (
      <motion.span {...motionProps} className={fullWidth ? "block w-full" : "inline-block"}>
        <a ref={ref} href={href} className={classes} {...props}>
          {content}
        </a>
      </motion.span>
    );
  }

  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={classes}
      {...motionProps}
      {...props}
    >
      {content}
    </motion.button>
  );
});

export default Button;
