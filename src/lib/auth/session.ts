import "server-only";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/lib/db/client";
import { auth } from "@/lib/auth/server";
import { users, type User as DbUser } from "@/lib/db/schema";

type BetterAuthSession = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

export type CurrentSession = {
  session: BetterAuthSession["session"];
  user: DbUser;
};

export function rejectInactiveOrSoftDeletedUsers(
  user: DbUser | null | undefined,
): DbUser | null {
  if (!user || !user.isActive || user.deletedAt) {
    return null;
  }

  return user;
}

export async function getCurrentSession(): Promise<CurrentSession | null> {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session) {
    return null;
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  const activeUser = rejectInactiveOrSoftDeletedUsers(user);

  if (!activeUser) {
    return null;
  }

  return {
    session: session.session,
    user: activeUser,
  };
}

export async function requireAuthenticatedUser(): Promise<CurrentSession> {
  const currentSession = await getCurrentSession();

  if (!currentSession) {
    redirect("/login");
  }

  return currentSession;
}
