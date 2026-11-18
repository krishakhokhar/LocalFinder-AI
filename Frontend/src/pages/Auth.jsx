import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import { toast } from "react-toastify";
import {
  ArrowRight,
  Building2,
  Check,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MapPin,
  Phone,
  Sparkles,
  User as UserIcon,
} from "lucide-react";
import AppShell from "../components/layout/AppShell";
import Button from "../components/common/Button";
import { Input } from "../components/common/Field";
import useMotionSafe from "../hooks/useMotionSafe";
import { fadeUp, staggerContainer } from "../utils/motion";
import { useAuth } from "../context/AuthContext";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Mirrors the server's policy exactly, so the form never promises more. */
function passwordChecks(password) {
  return [
    { label: "At least 6 characters", met: password.length >= 6 },
    { label: "Contains a letter", met: /[A-Za-z]/.test(password) },
    { label: "Contains a number", met: /\d/.test(password) },
  ];
}

const HIGHLIGHTS = [
  "Save places and come back to them on any device",
  "Write reviews that other people actually rely on",
  "Book appointments and track them in one place",
];

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { login, register, isAuthenticated } = useAuth();
  const { variants } = useMotionSafe();

  const [mode, setMode] = useState(() => (searchParams.get("mode") === "register" ? "register" : "login"));
  const [asOwner, setAsOwner] = useState(() => searchParams.get("role") === "owner");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "", phone: "" });

  const redirectTo = location.state?.from || "/";

  useEffect(() => {
    if (isAuthenticated) navigate(redirectTo, { replace: true });
  }, [isAuthenticated, navigate, redirectTo]);

  const checks = useMemo(() => passwordChecks(form.password), [form.password]);
  const isRegister = mode === "register";

  const update = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validate = () => {
    const next = {};
    if (!EMAIL_PATTERN.test(form.email)) next.email = "Enter a valid email address";
    if (!form.password) next.password = "Password is required";

    if (isRegister) {
      if (form.name.trim().length < 2) next.name = "Enter your full name";
      if (checks.some((check) => !check.met)) {
        next.password = "Password must be 6+ characters with a letter and a number";
      }
      if (form.password !== form.confirm) next.confirm = "Passwords do not match";
      if (asOwner && form.phone.trim().length < 6) {
        next.phone = "A contact number is required for business accounts";
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      if (isRegister) {
        const user = await register({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          role: asOwner ? "owner" : "customer",
          ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
        });
        toast.success(`Welcome, ${user.name.split(" ")[0]}`);
        navigate(asOwner ? "/owner" : redirectTo, { replace: true });
      } else {
        const user = await login({ email: form.email.trim(), password: form.password });
        toast.success(`Welcome back, ${user.name.split(" ")[0]}`);
        navigate(redirectTo, { replace: true });
      }
    } catch (error) {
      // Field-level messages from the server take priority over the toast.
      const fieldErrors = {};
      for (const field of ["name", "email", "password", "phone"]) {
        const message = error.fieldError?.(field);
        if (message) fieldErrors[field] = message;
      }
      setErrors(fieldErrors);
      if (Object.keys(fieldErrors).length === 0) {
        toast.error(error.message || "Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = () => {
    setMode((current) => (current === "login" ? "register" : "login"));
    setErrors({});
  };

  return (
    <AppShell footer={false}>
      <div className="grid min-h-[calc(100dvh-4rem)] lg:grid-cols-2">
        {/* Form */}
        <div className="flex items-center justify-center px-5 py-12 sm:px-8">
          <motion.div
            variants={variants(staggerContainer(0.06))}
            initial="hidden"
            animate="visible"
            className="w-full max-w-md"
          >
            <motion.div variants={variants(fadeUp)}>
              <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
                {isRegister ? "Create your account" : "Welcome back"}
              </h1>
              <p className="mt-2 text-sm text-ink-muted">
                {isRegister
                  ? "It takes about thirty seconds, and it is free."
                  : "Sign in to reach your saved places, reviews and bookings."}
              </p>
            </motion.div>

            {isRegister ? (
              <motion.div variants={variants(fadeUp)} className="mt-6">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-faint">
                  I am signing up as
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAsOwner(false)}
                    aria-pressed={!asOwner}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      !asOwner
                        ? "border-brand-600 bg-brand-50 ring-2 ring-brand-600/15"
                        : "border-line bg-surface hover:border-line-strong"
                    }`}
                  >
                    <UserIcon
                      className={`h-4 w-4 ${!asOwner ? "text-brand-600" : "text-ink-faint"}`}
                      aria-hidden="true"
                    />
                    <span className="mt-1.5 block text-sm font-bold text-ink">A customer</span>
                    <span className="mt-0.5 block text-xs text-ink-muted">Find and book services</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAsOwner(true)}
                    aria-pressed={asOwner}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      asOwner
                        ? "border-brand-600 bg-brand-50 ring-2 ring-brand-600/15"
                        : "border-line bg-surface hover:border-line-strong"
                    }`}
                  >
                    <Building2
                      className={`h-4 w-4 ${asOwner ? "text-brand-600" : "text-ink-faint"}`}
                      aria-hidden="true"
                    />
                    <span className="mt-1.5 block text-sm font-bold text-ink">A business owner</span>
                    <span className="mt-0.5 block text-xs text-ink-muted">List and manage a business</span>
                  </button>
                </div>
              </motion.div>
            ) : null}

            <motion.form variants={variants(fadeUp)} onSubmit={submit} className="mt-6 space-y-4" noValidate>
              {isRegister ? (
                <Input
                  label="Full name"
                  icon={UserIcon}
                  value={form.name}
                  onChange={update("name")}
                  error={errors.name}
                  autoComplete="name"
                  placeholder="Your name"
                  required
                />
              ) : null}

              <Input
                label="Email"
                type="email"
                icon={Mail}
                value={form.email}
                onChange={update("email")}
                error={errors.email}
                autoComplete="email"
                placeholder="you@example.com"
                required
              />

              {isRegister && asOwner ? (
                <Input
                  label="Contact phone"
                  type="tel"
                  icon={Phone}
                  value={form.phone}
                  onChange={update("phone")}
                  error={errors.phone}
                  autoComplete="tel"
                  placeholder="For customers to reach your business"
                  required
                />
              ) : null}

              <Input
                label="Password"
                type={showPassword ? "text" : "password"}
                icon={Lock}
                value={form.password}
                onChange={update("password")}
                error={errors.password}
                autoComplete={isRegister ? "new-password" : "current-password"}
                placeholder={isRegister ? "Create a password" : "Your password"}
                required
                suffix={
                  <button
                    type="button"
                    onClick={() => setShowPassword((shown) => !shown)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="rounded-lg p-2 text-ink-faint transition-colors hover:bg-slate-100 hover:text-ink"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                }
              />

              {isRegister ? (
                <>
                  <ul className="-mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    {checks.map((check) => (
                      <li
                        key={check.label}
                        className={`flex items-center gap-1.5 text-xs transition-colors ${
                          check.met ? "text-success-600" : "text-ink-faint"
                        }`}
                      >
                        <Check
                          className={`h-3 w-3 ${check.met ? "opacity-100" : "opacity-40"}`}
                          aria-hidden="true"
                        />
                        {check.label}
                      </li>
                    ))}
                  </ul>

                  <Input
                    label="Confirm password"
                    type={showPassword ? "text" : "password"}
                    icon={Lock}
                    value={form.confirm}
                    onChange={update("confirm")}
                    error={errors.confirm}
                    autoComplete="new-password"
                    placeholder="Type it once more"
                    required
                  />
                </>
              ) : null}

              <Button type="submit" size="lg" fullWidth loading={submitting} iconRight={ArrowRight}>
                {isRegister ? "Create account" : "Sign in"}
              </Button>
            </motion.form>

            <motion.p variants={variants(fadeUp)} className="mt-5 text-center text-sm text-ink-muted">
              {isRegister ? "Already have an account?" : "New to LocalFinder?"}{" "}
              <button
                type="button"
                onClick={switchMode}
                className="font-semibold text-brand-700 underline-offset-2 hover:underline"
              >
                {isRegister ? "Sign in" : "Create one"}
              </button>
            </motion.p>

            <motion.p variants={variants(fadeUp)} className="mt-6 text-center text-xs text-ink-faint">
              By continuing you agree that reviews you post are your own and may be moderated.{" "}
              <Link to="/contact" className="underline underline-offset-2 hover:text-ink-muted">
                Questions?
              </Link>
            </motion.p>
          </motion.div>
        </div>

        {/* Side panel */}
        <aside className="relative hidden overflow-hidden bg-ink lg:block">
          <div aria-hidden="true" className="absolute inset-0">
            <div className="absolute -left-20 top-1/4 h-80 w-80 rounded-full bg-brand-600/25 blur-3xl" />
            <div className="absolute -right-10 bottom-10 h-72 w-72 rounded-full bg-ai-500/20 blur-3xl" />
          </div>

          <div className="relative flex h-full flex-col justify-center px-14">
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-brand-200">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              AI-powered local discovery
            </span>

            <h2 className="mt-6 max-w-sm font-display text-3xl font-extrabold leading-tight text-white">
              Discover local. Compare smart. Choose better.
            </h2>

            <ul className="mt-8 space-y-4">
              {HIGHLIGHTS.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-slate-300">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-500/20">
                    <Check className="h-3 w-3 text-success-500" aria-hidden="true" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>

            <div className="mt-10 flex items-center gap-2 text-xs text-slate-400">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              Place data &copy; OpenStreetMap contributors
            </div>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
