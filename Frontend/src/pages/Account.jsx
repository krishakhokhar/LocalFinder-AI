import { useState } from "react";
import { toast } from "react-toastify";
import { KeyRound, Mail, Phone, Save, ShieldCheck, User as UserIcon } from "lucide-react";
import AppShell from "../components/layout/AppShell";
import PageTransition from "../components/motion/PageTransition";
import Button from "../components/common/Button";
import { Input } from "../components/common/Field";
import Badge from "../components/common/Badge";
import Avatar from "../components/common/Avatar";
import authApi from "../services/authApi";
import { useAuth } from "../context/AuthContext";

const ROLE_LABELS = {
  customer: "Customer",
  owner: "Business owner",
  admin: "Administrator",
};

/** Profile details and password, both backed by real endpoints. */
export default function Account() {
  const { user, setUser } = useAuth();

  const [profile, setProfile] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    city: user?.city || "",
  });
  const [profileErrors, setProfileErrors] = useState({});
  const [savingProfile, setSavingProfile] = useState(false);

  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "" });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [savingPassword, setSavingPassword] = useState(false);

  const saveProfile = async (event) => {
    event.preventDefault();
    setSavingProfile(true);
    setProfileErrors({});
    try {
      const data = await authApi.updateProfile({
        name: profile.name.trim(),
        phone: profile.phone.trim() || null,
        city: profile.city.trim() || null,
      });
      setUser(data.user);
      toast.success("Profile updated");
    } catch (error) {
      setProfileErrors({
        name: error.fieldError?.("name"),
        phone: error.fieldError?.("phone"),
        city: error.fieldError?.("city"),
      });
      toast.error(error.message || "Could not update your profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    setSavingPassword(true);
    setPasswordErrors({});
    try {
      await authApi.changePassword(passwords);
      setPasswords({ currentPassword: "", newPassword: "" });
      toast.success("Password changed");
    } catch (error) {
      setPasswordErrors({
        currentPassword: error.fieldError?.("currentPassword"),
        newPassword: error.fieldError?.("newPassword"),
      });
      toast.error(error.message || "Could not change your password");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <AppShell>
      <PageTransition>
        <div className="lf-container max-w-3xl py-10 sm:py-14">
          <header className="flex items-center gap-4">
            <Avatar name={user?.name} email={user?.email} src={user?.avatarUrl} size="lg" />
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">
                {user?.name}
              </h1>
              <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                  {user?.email}
                </span>
                <Badge tone={user?.role === "admin" ? "ai" : "brand"} size="xs" icon={ShieldCheck}>
                  {ROLE_LABELS[user?.role] || "Member"}
                </Badge>
              </p>
            </div>
          </header>

          <section className="lf-card mt-8 p-6">
            <h2 className="font-display text-base font-bold text-ink">Profile</h2>
            <p className="mt-0.5 text-sm text-ink-muted">
              Your name is shown on reviews you write and on bookings you make.
            </p>

            <form onSubmit={saveProfile} className="mt-5 grid gap-4 sm:grid-cols-2">
              <Input
                label="Full name"
                icon={UserIcon}
                value={profile.name}
                onChange={(event) => setProfile((prev) => ({ ...prev, name: event.target.value }))}
                error={profileErrors.name}
                required
                autoComplete="name"
              />
              <Input
                label="Phone"
                icon={Phone}
                value={profile.phone}
                onChange={(event) => setProfile((prev) => ({ ...prev, phone: event.target.value }))}
                error={profileErrors.phone}
                hint="Shared with a business only when you book with them."
                autoComplete="tel"
              />
              <Input
                label="City"
                value={profile.city}
                onChange={(event) => setProfile((prev) => ({ ...prev, city: event.target.value }))}
                error={profileErrors.city}
                autoComplete="address-level2"
                className="sm:col-span-2"
              />
              <div className="sm:col-span-2">
                <Button type="submit" icon={Save} loading={savingProfile}>
                  Save changes
                </Button>
              </div>
            </form>
          </section>

          <section className="lf-card mt-6 p-6">
            <h2 className="font-display text-base font-bold text-ink">Password</h2>
            <p className="mt-0.5 text-sm text-ink-muted">
              At least 6 characters, including a letter and a number.
            </p>

            <form onSubmit={savePassword} className="mt-5 grid gap-4 sm:grid-cols-2">
              <Input
                label="Current password"
                type="password"
                icon={KeyRound}
                value={passwords.currentPassword}
                onChange={(event) =>
                  setPasswords((prev) => ({ ...prev, currentPassword: event.target.value }))
                }
                error={passwordErrors.currentPassword}
                required
                autoComplete="current-password"
              />
              <Input
                label="New password"
                type="password"
                icon={KeyRound}
                value={passwords.newPassword}
                onChange={(event) =>
                  setPasswords((prev) => ({ ...prev, newPassword: event.target.value }))
                }
                error={passwordErrors.newPassword}
                required
                autoComplete="new-password"
              />
              <div className="sm:col-span-2">
                <Button type="submit" variant="outline" loading={savingPassword}>
                  Change password
                </Button>
              </div>
            </form>
          </section>
        </div>
      </PageTransition>
    </AppShell>
  );
}
