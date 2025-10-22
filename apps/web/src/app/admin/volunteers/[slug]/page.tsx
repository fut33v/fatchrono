"use client";

import { use } from "react";
import VolunteerDashboard from "../../_components/volunteer-dashboard";

type VolunteerPageProps = {
  params: Promise<{ slug: string }> | { slug: string };
};

export default function VolunteerPage({ params }: VolunteerPageProps) {
  const resolved =
    typeof (params as Promise<unknown>).then === "function"
      ? use(params as Promise<{ slug: string }>)
      : (params as { slug: string });

  return <VolunteerDashboard slug={resolved.slug} />;
}
