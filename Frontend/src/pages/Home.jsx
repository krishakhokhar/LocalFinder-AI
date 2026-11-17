import AppShell from "../components/layout/AppShell";
import PageTransition from "../components/motion/PageTransition";
import Hero from "../components/home/Hero";
import CategoryGrid from "../components/home/CategoryGrid";
import NearbyPreview from "../components/home/NearbyPreview";
import HowItWorks from "../components/home/HowItWorks";
import TrustStrip from "../components/home/TrustStrip";
import OwnerCta from "../components/home/OwnerCta";

export default function Home() {
  return (
    <AppShell>
      <PageTransition>
        <Hero />
        <CategoryGrid />
        <NearbyPreview />
        <HowItWorks />
        <TrustStrip />
        <OwnerCta />
      </PageTransition>
    </AppShell>
  );
}
