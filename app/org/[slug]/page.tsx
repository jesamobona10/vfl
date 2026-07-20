import { redirect } from "next/navigation";

export default function OrgIndexPage({ params }: { params: { slug: string } }) {
  redirect(`/org/${params.slug}/dashboard`);
}
