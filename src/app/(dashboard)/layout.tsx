import { requireAuthenticatedUser } from "@/lib/auth/session";
import { AppShell } from "@/components/shell/app-shell";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireAuthenticatedUser();

  return <AppShell session={session}>{children}</AppShell>;
}
