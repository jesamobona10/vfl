import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vfl-iota.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/org", "/dashboard", "/auth"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}