import { Navigate, useLocation } from "react-router-dom";
import { Lock } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import Spinner from "./Spinner";
import EmptyState from "./EmptyState";
import Button from "./Button";
import AppShell from "../layout/AppShell";

/**
 * Client-side route guard.
 *
 * This is purely a navigation convenience: it stops a signed-out user
 * landing on an empty dashboard. It is NOT security. Every protected
 * endpoint enforces authentication and role on the server, so removing
 * this component in devtools gains an attacker nothing.
 */
export default function ProtectedRoute({ children, roles = null }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <AppShell footer={false}>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Spinner size="lg" label="Checking your session" />
        </div>
      </AppShell>
    );
  }

  if (!isAuthenticated) {
    // Remember where they were headed so sign-in can return them there.
    return <Navigate to="/auth" state={{ from: location.pathname + location.search }} replace />;
  }

  if (roles && !roles.includes(user?.role)) {
    return (
      <AppShell>
        <EmptyState
          icon={Lock}
          tone="warning"
          title="You do not have access to this area"
          description={`This page is for ${roles.join(" and ")} accounts. If you think that is wrong, contact support.`}
          action={
            <Button to="/" variant="outline">
              Back to home
            </Button>
          }
          className="min-h-[60vh]"
        />
      </AppShell>
    );
  }

  return children;
}
