import { useState } from "react";
import { Clock, Plus, Trash2 } from "lucide-react";
import Button from "../common/Button";
import { Input, Textarea } from "../common/Field";
import { formatPrice } from "../../utils/format";

const BLANK = { name: "", description: "", durationMinutes: 30, price: "", currency: "INR", active: true };

/**
 * Editable list of the services a business offers.
 *
 * Price is deliberately optional and stored as null when left blank -
 * "Price on request" is a real answer, and far better than a zero that
 * customers would read as free. The duration is required because the
 * booking system builds slots from it.
 */
export default function ServiceEditor({ services = [], onChange, error }) {
  const [draft, setDraft] = useState(BLANK);
  const [adding, setAdding] = useState(false);

  const add = () => {
    if (draft.name.trim().length < 2) return;
    onChange([
      ...services,
      {
        ...draft,
        name: draft.name.trim(),
        description: draft.description.trim() || undefined,
        durationMinutes: Number(draft.durationMinutes) || 30,
        price: draft.price === "" ? null : Number(draft.price),
      },
    ]);
    setDraft(BLANK);
    setAdding(false);
  };

  const update = (index, patch) => {
    onChange(services.map((service, position) => (position === index ? { ...service, ...patch } : service)));
  };

  const remove = (index) => onChange(services.filter((unused, position) => position !== index));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-ink-soft">
          Services <span className="font-normal text-ink-faint">({services.length})</span>
        </p>
        {!adding ? (
          <Button type="button" variant="outline" size="xs" icon={Plus} onClick={() => setAdding(true)}>
            Add service
          </Button>
        ) : null}
      </div>

      {services.length === 0 && !adding ? (
        <p className="rounded-card border border-dashed border-line bg-surface px-4 py-6 text-center text-sm text-ink-muted">
          No services yet. Customers want to know what you offer and roughly what it costs.
        </p>
      ) : null}

      <ul className="space-y-2">
        {services.map((service, index) => (
          <li key={service._id || `${service.name}-${index}`} className="rounded-card border border-line bg-surface p-3">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <input
                  value={service.name}
                  onChange={(event) => update(index, { name: event.target.value })}
                  aria-label="Service name"
                  placeholder="Service name"
                  className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm font-semibold text-ink focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
                />

                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1">
                    <Clock className="h-3.5 w-3.5 text-ink-faint" aria-hidden="true" />
                    <input
                      type="number"
                      min="5"
                      max="600"
                      step="5"
                      value={service.durationMinutes}
                      onChange={(event) => update(index, { durationMinutes: Number(event.target.value) })}
                      aria-label="Duration in minutes"
                      className="w-14 bg-transparent text-xs tabular-nums text-ink-soft focus:outline-none"
                    />
                    <span className="text-xs text-ink-faint">min</span>
                  </label>

                  <label className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2 py-1">
                    <span className="text-xs text-ink-faint">&#8377;</span>
                    <input
                      type="number"
                      min="0"
                      step="10"
                      value={service.price ?? ""}
                      onChange={(event) =>
                        update(index, { price: event.target.value === "" ? null : Number(event.target.value) })
                      }
                      aria-label="Price, leave blank for price on request"
                      placeholder="On request"
                      className="w-24 bg-transparent text-xs tabular-nums text-ink-soft placeholder:text-ink-faint focus:outline-none"
                    />
                  </label>

                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink-muted">
                    <input
                      type="checkbox"
                      checked={service.active !== false}
                      onChange={(event) => update(index, { active: event.target.checked })}
                      className="h-3.5 w-3.5 rounded border-line text-brand-600 focus:ring-brand-600/30"
                    />
                    Visible
                  </label>
                </div>

                <input
                  value={service.description || ""}
                  onChange={(event) => update(index, { description: event.target.value })}
                  aria-label="Service description"
                  placeholder="Short description (optional)"
                  maxLength={500}
                  className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink-muted focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
                />

                <p className="text-2xs text-ink-faint">
                  Shown as{" "}
                  {service.price === null || service.price === undefined || service.price === ""
                    ? "“Price on request”"
                    : formatPrice(Number(service.price), service.currency || "INR")}
                  , about {service.durationMinutes} minutes.
                </p>
              </div>

              <button
                type="button"
                onClick={() => remove(index)}
                aria-label={`Remove ${service.name || "this service"}`}
                className="shrink-0 rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-danger-50 hover:text-danger-600"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {adding ? (
        <div className="mt-2 rounded-card border border-brand-200 bg-brand-50/40 p-3">
          <Input
            label="Service name"
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            placeholder="e.g. Haircut & styling"
            data-autofocus
            required
          />

          <div className="mt-3 grid grid-cols-2 gap-3">
            <Input
              label="Duration (minutes)"
              type="number"
              min="5"
              max="600"
              step="5"
              value={draft.durationMinutes}
              onChange={(event) => setDraft((current) => ({ ...current, durationMinutes: event.target.value }))}
            />
            <Input
              label="Price"
              type="number"
              min="0"
              step="10"
              value={draft.price}
              onChange={(event) => setDraft((current) => ({ ...current, price: event.target.value }))}
              placeholder="Leave blank for on request"
              hint="Optional"
            />
          </div>

          <Textarea
            label="Description"
            className="mt-3"
            rows={2}
            value={draft.description}
            onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
            maxLength={500}
            placeholder="Optional"
          />

          <div className="mt-3 flex gap-2">
            <Button type="button" size="sm" onClick={add} disabled={draft.name.trim().length < 2}>
              Add service
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setAdding(false);
                setDraft(BLANK);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-1.5 text-xs font-medium text-danger-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
