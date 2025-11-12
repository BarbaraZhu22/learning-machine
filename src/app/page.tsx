"use client";

import HomeHero from "@/app/home/HomeHero";
import HomeHighlights from "@/app/home/HomeHighlights";

const sections = [
  { titleKey: "notes", href: "/note", ctaKey: "openNotesCta" },
  { titleKey: "simulateDialog", href: "/dialog", ctaKey: "startDialogCta" },
  { titleKey: "superExtension", href: "/extension", ctaKey: "openExtensionCta" },
];

export default function Home() {
  return (
    <div className="space-y-10">
      <HomeHero />
      <HomeHighlights sections={sections} />
    </div>
  );
}
