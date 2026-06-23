import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth/session";

export default async function HomePage() {
  const currentSession = await getCurrentSession();

  redirect(currentSession ? "/dashboard" : "/login");
}
