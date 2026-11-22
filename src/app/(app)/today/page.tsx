import { redirect } from "next/navigation";

/** Today was merged into the path home screen. */
export default function TodayPage() {
  redirect("/learn");
}
