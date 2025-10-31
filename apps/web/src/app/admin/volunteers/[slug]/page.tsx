"use client";

import type { PageProps } from "next";
import { use } from "react";
import VolunteerDashboard from "../../_components/volunteer-dashboard";

type VolunteerPageProps = PageProps<{ slug: string }>;

export default function VolunteerPage({ params }: VolunteerPageProps) {
  if (!params) {
    throw new Error("Volunteer slug params are missing.");
  }

  const paramsPromise: Promise<{ slug: string }> =
    typeof (params as Promise<unknown>).then === "function"
      ? (params as Promise<{ slug: string }>)
      : Promise.resolve(params as { slug: string });

  const { slug } = use(paramsPromise);

  return <VolunteerDashboard slug={slug} />;
}
