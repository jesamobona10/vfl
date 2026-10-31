import { createClient } from "@/lib/supabase/server";
import { getCached } from "./index";

export async function getPublicOrganizationsCached() {
  return getCached(
    "public:organizations:list",
    async () => {
      const supabase = await createClient();
      const { data, error } = await supabase.rpc("list_public_organizations");
      if (error || !data) {
        const { data: orgs } = await supabase
          .from("organizations")
          .select("id, name, slug, logo_url, brand_color")
          .eq("is_public", true)
          .order("name");
        return orgs ?? [];
      }
      return data;
    },
    { ttl: 600, tags: ["public:organizations"] }
  );
}
