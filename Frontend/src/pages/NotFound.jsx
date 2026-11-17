import { Compass, Home } from "lucide-react";
import AppShell from "../components/layout/AppShell";
import PageTransition from "../components/motion/PageTransition";
import EmptyState from "../components/common/EmptyState";
import Button from "../components/common/Button";

export default function NotFound() {
  return (
    <AppShell>
      <PageTransition>
        <EmptyState
          icon={Compass}
          title="We could not find that page"
          description="The link may be out of date, or the page may have moved. Try searching for what you need instead."
          action={
            <Button to="/" icon={Home}>
              Back to home
            </Button>
          }
          secondaryAction={
            <Button to="/explore" variant="outline">
              Explore nearby
            </Button>
          }
          className="min-h-[65vh]"
        />
      </PageTransition>
    </AppShell>
  );
}
