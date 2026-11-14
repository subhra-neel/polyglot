import type { Metadata } from "next";
import { ComingNext, Screen } from "@/components/screen";

export const metadata: Metadata = { title: "Talk" };

export default function TalkPage() {
  return (
    <Screen title="Talk" lead="Practise real situations with the tutor.">
      <ComingNext milestone="Coming in phase 3">
        Three roleplays to start: introducing yourself, ordering food, and an auto ride. You type in English
        letters and the tutor replies the same way. Voice follows in phase 4.
      </ComingNext>
    </Screen>
  );
}
