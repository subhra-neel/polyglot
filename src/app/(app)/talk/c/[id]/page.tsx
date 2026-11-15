import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/screen";
import { SetupNotice } from "@/components/setup-notice";
import { TutorChat } from "@/components/tutor-chat";
import { getCurrentUser } from "@/lib/auth";
import { UUID, getConversation, type Conversation } from "@/lib/conversations";
import { ContentUnavailableError } from "@/lib/lessons";
import { getProgress } from "@/lib/progress";
import { getTtsProvider } from "@/lib/tts";

export const metadata: Metadata = { title: "Conversation" };

async function Chat({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  await getCurrentUser();

  let conversation: Conversation | null;
  let settings: { show_english: boolean; show_script: boolean };
  try {
    [conversation, settings] = await Promise.all([getConversation(id), getProgress()]);
  } catch (error) {
    if (error instanceof ContentUnavailableError) return <SetupNotice detail={error.message} />;
    throw error;
  }
  if (!conversation) notFound();

  const personaName = conversation.scenario.persona.split(",")[0];

  return (
    <>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">{conversation.scenario.title}</h1>
      <p className="mt-1 text-sm leading-relaxed text-muted">{conversation.scenario.setting}</p>
      <div className="mt-5">
        <TutorChat
          conversationId={conversation.id}
          personaName={personaName}
          hint={conversation.scenario.opening_hint}
          initial={conversation.messages}
          ended={Boolean(conversation.ended_at)}
          showEnglish={settings.show_english}
          showScript={settings.show_script}
          audioEnabled={getTtsProvider() !== null}
        />
      </div>
    </>
  );
}

export default function ConversationPage({ params }: PageProps<"/talk/c/[id]">) {
  return (
    <>
      <Link href="/talk" className="text-sm font-medium text-accent">
        ‹ Scenes
      </Link>
      <Suspense fallback={<ListSkeleton rows={3} />}>
        <Chat params={params} />
      </Suspense>
    </>
  );
}
