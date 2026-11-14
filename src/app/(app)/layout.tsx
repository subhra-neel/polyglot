import { TabBar } from "@/components/tab-bar";

/**
 * Frame for the signed-in app. The proxy has already turned away anyone
 * without a session; pages read the learner inside their own Suspense
 * boundaries, so this frame renders instantly.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <main className="mx-auto w-full max-w-md flex-1 px-6 pb-32 pt-10">{children}</main>
      <TabBar />
    </>
  );
}
