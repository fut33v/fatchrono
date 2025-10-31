"use client";

import type { PageProps } from "next";
import { use } from "react";
import AdminDashboard from "../../_components/admin-dashboard";

type RaceAdminPageProps = PageProps<{ slug: string }>;

export default function RaceAdminPage({ params }: RaceAdminPageProps) {
  if (!params) {
    throw new Error("Race slug params are missing.");
  }

  const paramsPromise: Promise<{ slug: string }> =
    typeof (params as Promise<unknown>).then === "function"
      ? (params as Promise<{ slug: string }>)
      : Promise.resolve(params as { slug: string });

  const { slug } = use(paramsPromise);

  return <AdminDashboard raceSlug={slug} />;
}
