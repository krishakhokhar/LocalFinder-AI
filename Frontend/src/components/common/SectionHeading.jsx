import Reveal from "./Reveal";

/** Eyebrow + title + subtitle, used at the top of every marketing section. */
export default function SectionHeading({ eyebrow, title, subtitle, align = "center", className = "" }) {
  const alignment = align === "left" ? "text-left items-start" : "text-center items-center";

  return (
    <Reveal className={`flex flex-col ${alignment} ${className}`}>
      {eyebrow ? (
        <span className="mb-3 inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-700">
          {eyebrow}
        </span>
      ) : null}
      <h2 className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl lg:text-[2.1rem]">
        {title}
      </h2>
      {subtitle ? (
        <p className={`mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted sm:text-base ${align === "center" ? "mx-auto" : ""}`}>
          {subtitle}
        </p>
      ) : null}
    </Reveal>
  );
}
