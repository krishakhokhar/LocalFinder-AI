import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CalendarCheck,
  ExternalLink,
  Save,
  Send,
  Trash2,
} from "lucide-react";
import AppShell from "../../components/layout/AppShell";
import PageTransition from "../../components/motion/PageTransition";
import Button from "../../components/common/Button";
import Badge from "../../components/common/Badge";
import Modal from "../../components/common/Modal";
import ErrorState from "../../components/common/ErrorState";
import Skeleton from "../../components/common/Skeleton";
import { Checkbox, Input, Select, Textarea } from "../../components/common/Field";
import LocationPicker from "../../components/business/LocationPicker";
import HoursEditor, { DEFAULT_HOURS } from "../../components/business/HoursEditor";
import ServiceEditor from "../../components/business/ServiceEditor";
import ImageUploader from "../../components/business/ImageUploader";
import businessApi from "../../services/businessApi";
import placesApi from "../../services/placesApi";
import { BUILT_IN_CATEGORY_FALLBACK } from "../../config/categories";

const STATUS_COPY = {
  draft: { tone: "neutral", label: "Draft", note: "Only you can see this. Submit it when you are ready." },
  pending: { tone: "warning", label: "In review", note: "An admin is reviewing this listing." },
  approved: { tone: "success", label: "Live", note: "Customers can find this listing in search." },
  rejected: { tone: "danger", label: "Rejected", note: "Address the feedback below and resubmit." },
  suspended: { tone: "danger", label: "Suspended", note: "Contact support about this listing." },
};

const EMPTY = {
  name: "",
  category: "salon",
  description: "",
  phone: "",
  email: "",
  website: "",
  address: { line1: "", area: "", city: "", state: "", pincode: "", country: "India" },
  logoUrl: null,
  gallery: [],
  openingHours: DEFAULT_HOURS,
  services: [],
  acceptsBookings: false,
};

/**
 * Create or edit a listing.
 *
 * The form never publishes directly. A new listing is saved as a draft
 * and has to be submitted; editing key details on a live listing sends
 * it back for review. That is enforced on the server too - this page
 * just explains it, so nothing the owner does is a surprise.
 */
export default function BusinessForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === "new";

  const [form, setForm] = useState(EMPTY);
  const [position, setPosition] = useState(null);
  const [categories, setCategories] = useState(BUILT_IN_CATEGORY_FALLBACK);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [loadError, setLoadError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    placesApi
      .categories()
      .then((data) => {
        const usable = (data.categories || []).filter((category) => category.key !== "all");
        if (usable.length) setCategories(usable);
      })
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    setLoadError("");
    try {
      const data = await businessApi.get(id);
      const business = data.business;
      setForm({
        name: business.name || "",
        category: business.category || "salon",
        description: business.description || "",
        phone: business.phone || "",
        email: business.email || "",
        website: business.website || "",
        address: {
          line1: business.address?.line1 || "",
          area: business.address?.area || "",
          city: business.address?.city || "",
          state: business.address?.state || "",
          pincode: business.address?.pincode || "",
          country: business.address?.country || "India",
        },
        logoUrl: business.logoUrl || null,
        gallery: business.gallery || [],
        openingHours: business.openingHours?.length === 7 ? business.openingHours : DEFAULT_HOURS,
        services: business.services || [],
        acceptsBookings: Boolean(business.acceptsBookings),
      });
      setPosition({ lat: business.lat, lng: business.lng });
      setMeta({
        status: business.status,
        verified: business.verified,
        rejectionReason: business.rejectionReason,
        _id: business._id,
      });
    } catch (error) {
      setLoadError(
        error.status === 404 ? "That listing does not exist, or it is not yours." : error.message
      );
    } finally {
      setLoading(false);
    }
  }, [id, isNew]);

  useEffect(() => {
    load();
  }, [load]);

  const set = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  const setAddress = (field) => (event) =>
    setForm((current) => ({ ...current, address: { ...current.address, [field]: event.target.value } }));

  const validate = () => {
    const next = {};
    if (form.name.trim().length < 2) next.name = "Enter your business name";
    if (!form.category) next.category = "Pick a category";
    if (!form.address.city.trim()) next.city = "City is required";
    if (!position) next.location = "Drop a pin on the map so customers can find you";
    if (!form.phone.trim() && !form.email.trim()) {
      next.phone = "Give at least one way for customers to reach you";
    }
    if (form.website && !/^https?:\/\//i.test(form.website)) {
      next.website = "Include https:// at the start";
    }
    for (const row of form.openingHours) {
      if (!row.closed && row.open >= row.close) {
        next.hours = "Each open day needs a closing time later than its opening time";
        break;
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const payload = useMemo(
    () => ({
      name: form.name.trim(),
      category: form.category,
      description: form.description.trim() || undefined,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      website: form.website.trim() || undefined,
      address: {
        line1: form.address.line1.trim() || undefined,
        area: form.address.area.trim() || undefined,
        city: form.address.city.trim(),
        state: form.address.state.trim() || undefined,
        pincode: form.address.pincode.trim() || undefined,
        country: form.address.country.trim() || "India",
      },
      lat: position?.lat,
      lng: position?.lng,
      logoUrl: form.logoUrl || undefined,
      gallery: form.gallery,
      openingHours: form.openingHours,
      services: form.services.map((service) => ({
        name: service.name,
        description: service.description || undefined,
        durationMinutes: Number(service.durationMinutes) || 30,
        price: service.price === "" || service.price === undefined ? null : service.price,
        currency: service.currency || "INR",
        active: service.active !== false,
      })),
      acceptsBookings: form.acceptsBookings,
    }),
    [form, position]
  );

  const save = async (event) => {
    event?.preventDefault();
    if (!validate()) {
      toast.error("Please fix the highlighted fields");
      return null;
    }

    setSaving(true);
    try {
      if (isNew) {
        const data = await businessApi.create(payload);
        toast.success("Draft saved");
        navigate(`/owner/businesses/${data.business._id}`, { replace: true });
        return data.business;
      }
      const data = await businessApi.update(id, payload);
      toast.success(data.message || "Changes saved");
      setMeta((current) => ({ ...current, status: data.business.status, verified: data.business.verified }));
      return data.business;
    } catch (error) {
      const fieldErrors = {};
      for (const field of ["name", "category", "phone", "email", "website"]) {
        const message = error.fieldError?.(field);
        if (message) fieldErrors[field] = message;
      }
      setErrors(fieldErrors);
      toast.error(error.message || "Could not save your listing");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const submitForReview = async () => {
    const saved = await save();
    if (!saved) return;

    setSubmitting(true);
    try {
      const data = await businessApi.submit(saved._id || id);
      toast.success(data.message);
      setMeta((current) => ({ ...current, status: "pending", rejectionReason: null }));
    } catch (error) {
      toast.error(error.message || "Could not submit this listing");
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async () => {
    try {
      await businessApi.remove(id);
      toast.success("Listing deleted");
      navigate("/owner");
    } catch (error) {
      toast.error(error.message || "Could not delete this listing");
      setConfirmDelete(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="lf-container space-y-4 py-10">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-64 w-full rounded-card" />
          <Skeleton className="h-48 w-full rounded-card" />
        </div>
      </AppShell>
    );
  }

  if (loadError) {
    return (
      <AppShell>
        <div className="lf-container py-10">
          <ErrorState title="Could not open that listing" message={loadError} onRetry={load} />
          <Button to="/owner" variant="outline" className="mt-4">
            Back to dashboard
          </Button>
        </div>
      </AppShell>
    );
  }

  const status = meta ? STATUS_COPY[meta.status] || STATUS_COPY.draft : null;

  return (
    <AppShell>
      <PageTransition>
        <form onSubmit={save} className="lf-container max-w-3xl py-8 sm:py-10" noValidate>
          <button
            type="button"
            onClick={() => navigate("/owner")}
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to dashboard
          </button>

          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
                {isNew ? "Add your business" : form.name || "Edit listing"}
              </h1>
              {status ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge tone={status.tone}>{status.label}</Badge>
                  {meta.verified ? (
                    <Badge tone="success" icon={BadgeCheck}>
                      Verified
                    </Badge>
                  ) : null}
                  <span className="text-xs text-ink-muted">{status.note}</span>
                </div>
              ) : (
                <p className="mt-1.5 text-sm text-ink-muted">
                  Saved as a draft first. Submit it when you are ready and an admin will review it.
                </p>
              )}
            </div>

            {meta?.status === "approved" ? (
              <Button to={`/business/${meta._id}`} variant="outline" size="sm" iconRight={ExternalLink}>
                View public page
              </Button>
            ) : null}
          </header>

          {meta?.status === "rejected" && meta.rejectionReason ? (
            <div className="mt-5 flex items-start gap-3 rounded-card border border-danger-100 bg-danger-50 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger-600" aria-hidden="true" />
              <div>
                <p className="font-display text-sm font-bold text-danger-700">Why this was rejected</p>
                <p className="mt-0.5 text-sm text-danger-700/90">{meta.rejectionReason}</p>
              </div>
            </div>
          ) : null}

          {/* Basics */}
          <section className="lf-card mt-6 space-y-4 p-5 sm:p-6">
            <h2 className="font-display text-base font-bold text-ink">Business details</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Business name"
                value={form.name}
                onChange={set("name")}
                error={errors.name}
                placeholder="e.g. Shades of Black Salon"
                required
              />
              <Select
                label="Category"
                value={form.category}
                onChange={set("category")}
                error={errors.category}
                options={categories.map((category) => ({ value: category.key, label: category.label }))}
                required
              />
            </div>

            <Textarea
              label="Description"
              rows={4}
              value={form.description}
              onChange={set("description")}
              maxLength={2000}
              hint={`${form.description.length}/2000 — what you do, what makes you worth choosing`}
              placeholder="Tell customers what you offer and what to expect."
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Phone"
                type="tel"
                value={form.phone}
                onChange={set("phone")}
                error={errors.phone}
                placeholder="Customers tap this to call you"
              />
              <Input
                label="Email"
                type="email"
                value={form.email}
                onChange={set("email")}
                error={errors.email}
                placeholder="Optional"
              />
            </div>

            <Input
              label="Website"
              value={form.website}
              onChange={set("website")}
              error={errors.website}
              placeholder="https://"
            />
          </section>

          {/* Location */}
          <section className="lf-card mt-5 space-y-4 p-5 sm:p-6">
            <h2 className="font-display text-base font-bold text-ink">Where you are</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Street address"
                value={form.address.line1}
                onChange={setAddress("line1")}
                placeholder="Shop number and street"
                className="sm:col-span-2"
              />
              <Input label="Area" value={form.address.area} onChange={setAddress("area")} placeholder="Locality" />
              <Input
                label="City"
                value={form.address.city}
                onChange={setAddress("city")}
                error={errors.city}
                required
              />
              <Input label="State" value={form.address.state} onChange={setAddress("state")} />
              <Input label="PIN code" value={form.address.pincode} onChange={setAddress("pincode")} inputMode="numeric" />
            </div>

            <LocationPicker value={position} onChange={setPosition} error={errors.location} />
          </section>

          {/* Photos */}
          <section className="lf-card mt-5 space-y-5 p-5 sm:p-6">
            <h2 className="font-display text-base font-bold text-ink">Photos</h2>
            <ImageUploader
              label="Logo"
              single
              value={form.logoUrl}
              onChange={(url) => setForm((current) => ({ ...current, logoUrl: url }))}
              folder="business"
              hint="A square image works best."
            />
            <ImageUploader
              label="Gallery"
              value={form.gallery}
              onChange={(urls) => setForm((current) => ({ ...current, gallery: urls }))}
              max={8}
              folder="business"
            />
          </section>

          {/* Hours */}
          <section className="lf-card mt-5 p-5 sm:p-6">
            <HoursEditor
              value={form.openingHours}
              onChange={(hours) => setForm((current) => ({ ...current, openingHours: hours }))}
              error={errors.hours}
            />
          </section>

          {/* Services */}
          <section className="lf-card mt-5 p-5 sm:p-6">
            <ServiceEditor
              services={form.services}
              onChange={(services) => setForm((current) => ({ ...current, services }))}
            />

            <div className="mt-5 border-t border-line pt-4">
              <Checkbox
                label="Accept online appointments"
                description="Customers pick a real slot from your opening hours. You can accept or decline each request."
                checked={form.acceptsBookings}
                onChange={(event) =>
                  setForm((current) => ({ ...current, acceptsBookings: event.target.checked }))
                }
              />
              {form.acceptsBookings && form.services.filter((service) => service.active !== false).length === 0 ? (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-warning-700">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                  Add at least one visible service before bookings can be switched on.
                </p>
              ) : null}
            </div>
          </section>

          {/* Actions */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button type="submit" icon={Save} loading={saving}>
              {isNew ? "Save draft" : "Save changes"}
            </Button>

            {meta && ["draft", "rejected"].includes(meta.status) ? (
              <Button type="button" variant="success" icon={Send} onClick={submitForReview} loading={submitting}>
                Submit for review
              </Button>
            ) : null}

            {meta?.status === "approved" && form.acceptsBookings ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success-700">
                <CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Taking bookings
              </span>
            ) : null}

            {!isNew ? (
              <Button
                type="button"
                variant="dangerGhost"
                icon={Trash2}
                onClick={() => setConfirmDelete(true)}
                className="ml-auto"
              >
                Delete listing
              </Button>
            ) : null}
          </div>
        </form>

        <Modal
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          title="Delete this listing?"
          description="This removes it from LocalFinder permanently."
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                Keep it
              </Button>
              <Button variant="danger" onClick={remove}>
                Delete listing
              </Button>
            </>
          }
        >
          <p className="text-sm text-ink-muted">
            Reviews customers have written will go with it. If there are upcoming bookings, those have to be
            settled first.
          </p>
        </Modal>
      </PageTransition>
    </AppShell>
  );
}
