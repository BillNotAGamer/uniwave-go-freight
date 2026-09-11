import Link from "next/link";

import { PageContainer } from "@/components/shell/page-container";

export default function MasterDataLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <PageContainer><nav aria-label="Master Data" className="mb-6 flex gap-2 border-b border-border pb-3"><Link className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground" href="/admin/master-data/partners">Partners</Link><Link className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground" href="/admin/master-data/locations">Locations</Link></nav>{children}</PageContainer>;
}
