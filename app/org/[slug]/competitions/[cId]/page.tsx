import { redirect } from "next/navigation";

export default function CompetitionIndexPage({
  params,
}: {
  params: { slug: string; cId: string };
}) {
  redirect(`/org/${params.slug}/competitions/${params.cId}/fixtures`);
}
