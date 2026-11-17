import type { Metadata } from "next";
import Link from "next/link";
import { Screen } from "@/components/screen";
import { TutorSelfTest } from "@/components/tutor-self-test";
import { GOLDEN } from "@/lib/tutor/golden";

export const metadata: Metadata = { title: "Tutor self-test" };

export default function SelfTestPage() {
  return (
    <>
      <Link href="/talk" className="text-sm font-medium text-accent">
        ‹ Scenes
      </Link>
      <Screen
        title="Tutor self-test"
        lead={`Sends ${GOLDEN.length} known learner lines to the tutor's checker: mistakes it should catch and spoken forms it must accept. Uses a few paise of Sarvam credit.`}
      >
        <TutorSelfTest />
      </Screen>
    </>
  );
}
