import { redirect } from "next/navigation";

export default async function LegacyLiveRedirect(props: {
  params: Promise<{ slug: string; cId: string }>;
}) {
  const { slug, cId } = await props.params;
  redirect(`/org/${slug}/competitions/${cId}/fixtures`);
}
