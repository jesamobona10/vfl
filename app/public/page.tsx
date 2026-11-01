import { PublicDashboardClient } from "@/components/public/public-dashboard-client";
import { getPublicDashboardData } from "@/lib/public/server-fetchers";

export const revalidate = 60;

export default async function PublicPage() {
  const data = await getPublicDashboardData();
  return <PublicDashboardClient initialData={data} />;
}
