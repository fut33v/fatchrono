"use client";

import AdminDashboard from "../../_components/admin-dashboard";

type RaceAdminPageProps = {
  params: { slug: string };
};

export default function RaceAdminPage({ params }: RaceAdminPageProps) {
  return <AdminDashboard raceSlug={params.slug} />;
}
