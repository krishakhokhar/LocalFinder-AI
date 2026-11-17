import { useState } from "react";
import { toast } from "react-toastify";
import { CheckCircle2, Clock, Mail, MessageSquare, Send, Store, User as UserIcon } from "lucide-react";
import AppShell from "../components/layout/AppShell";
import PageTransition from "../components/motion/PageTransition";
import Button from "../components/common/Button";
import { Input, Textarea } from "../components/common/Field";
import Reveal from "../components/common/Reveal";
import contactApi from "../services/contactApi";
import { useAuth } from "../context/AuthContext";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CHANNELS = [
  {
    icon: Store,
    title: "List your business",
    body: "Create an owner account and submit your listing. An admin reviews every submission before it goes live.",
    action: { label: "Start a listing", to: "/auth?mode=register&role=owner" },
  },
  {
    icon: MessageSquare,
    title: "Report a listing or review",
    body: "Something inaccurate, fake or offensive? Use the report action on the listing itself so it reaches moderation with context.",
    action: { label: "Explore listings", to: "/explore" },
  },
];

export default function Contact() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    subject: "",
    message: "",
  });
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const update = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validate = () => {
    const next = {};
    if (form.name.trim().length < 2) next.name = "Please tell us your name";
    if (!EMAIL_PATTERN.test(form.email)) next.email = "Enter a valid email address";
    if (form.message.trim().length < 5) next.message = "Please write at least a few words";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    setSending(true);
    try {
      await contactApi.send({
        name: form.name.trim(),
        email: form.email.trim(),
        subject: form.subject.trim() || undefined,
        message: form.message.trim(),
      });
      setSent(true);
      setForm((current) => ({ ...current, subject: "", message: "" }));
      toast.success("Message sent. We will get back to you.");
    } catch (error) {
      const fieldErrors = {};
      for (const field of ["name", "email", "subject", "message"]) {
        const message = error.fieldError?.(field);
        if (message) fieldErrors[field] = message;
      }
      setErrors(fieldErrors);
      if (Object.keys(fieldErrors).length === 0) {
        toast.error(error.message || "Could not send your message. Please try again.");
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <AppShell>
      <PageTransition>
        <div className="lf-container py-12 sm:py-16">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
            {/* Intro */}
            <Reveal>
              <span className="inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-700">
                Contact
              </span>
              <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
                Talk to the team
              </h1>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-muted sm:text-base">
                Questions about a listing, a booking or your account? Send us a note and we will
                reply to the email address you give us.
              </p>

              <div className="mt-6 flex items-center gap-2.5 rounded-card border border-line bg-surface px-4 py-3">
                <Clock className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                <p className="text-sm text-ink-muted">
                  We usually reply within two working days.
                </p>
              </div>

              <div className="mt-6 space-y-3">
                {CHANNELS.map((channel) => (
                  <div key={channel.title} className="rounded-card border border-line bg-surface p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                        <channel.icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <h2 className="font-display text-sm font-bold text-ink">{channel.title}</h2>
                        <p className="mt-1 text-xs leading-relaxed text-ink-muted">{channel.body}</p>
                        <Button to={channel.action.to} variant="ghost" size="xs" className="mt-1.5 -ml-2">
                          {channel.action.label}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>

            {/* Form */}
            <Reveal delay={0.08}>
              <div className="lf-card p-6 sm:p-8">
                {sent ? (
                  <div className="mb-6 flex items-start gap-3 rounded-card border border-success-100 bg-success-50 p-4">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success-600" aria-hidden="true" />
                    <div>
                      <p className="font-display text-sm font-bold text-success-700">Message sent</p>
                      <p className="mt-0.5 text-sm text-success-700/90">
                        Thanks — we have it, and we will reply to {form.email}.
                      </p>
                    </div>
                  </div>
                ) : null}

                <form onSubmit={submit} className="space-y-4" noValidate>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Your name"
                      icon={UserIcon}
                      value={form.name}
                      onChange={update("name")}
                      error={errors.name}
                      autoComplete="name"
                      placeholder="Your name"
                      required
                    />
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
                  </div>

                  <Input
                    label="Subject"
                    value={form.subject}
                    onChange={update("subject")}
                    error={errors.subject}
                    placeholder="What is this about? (optional)"
                  />

                  <Textarea
                    label="Message"
                    rows={6}
                    value={form.message}
                    onChange={update("message")}
                    error={errors.message}
                    hint={`${form.message.length}/2000 characters`}
                    placeholder="Tell us what you need help with..."
                    maxLength={2000}
                    required
                  />

                  <Button type="submit" size="lg" fullWidth loading={sending} icon={Send}>
                    Send message
                  </Button>

                  <p className="text-center text-xs text-ink-faint">
                    We use your email only to reply to this message.
                  </p>
                </form>
              </div>
            </Reveal>
          </div>
        </div>
      </PageTransition>
    </AppShell>
  );
}
