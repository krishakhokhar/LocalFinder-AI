const SIZES = {
  xs: "h-7 w-7 text-xs",
  sm: "h-9 w-9 text-sm",
  md: "h-11 w-11 text-base",
  lg: "h-16 w-16 text-xl",
};

function initials(name, email) {
  const source = (name || email || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

/** Image when there is one, otherwise initials on the brand colour. */
export default function Avatar({ src, name, email, size = "sm", className = "" }) {
  const dimension = SIZES[size] || SIZES.sm;

  if (src) {
    return (
      <img
        src={src}
        alt={name ? `${name}'s profile photo` : "Profile photo"}
        loading="lazy"
        className={`${dimension} shrink-0 rounded-full border border-line object-cover ${className}`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`${dimension} inline-flex shrink-0 items-center justify-center rounded-full bg-brand-600 font-display font-bold text-white ${className}`}
    >
      {initials(name, email)}
    </span>
  );
}
