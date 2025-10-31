"use client";

import { use } from "react";
import AdminDashboard from "../../_components/admin-dashboard";

type RaceParams = { slug: string };

type RaceAdminPageProps = {
  params?: Promise<RaceParams>;
};

function isPromiseLike<T>(value: unknown): value is PromiseLike<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

function hasSlug(params: unknown): params is RaceParams {
  return (
    typeof params === "object" &&
    params !== null &&
    "slug" in params &&
    typeof (params as { slug: unknown }).slug === "string"
  );
}

export default function RaceAdminPage({ params }: RaceAdminPageProps) {
  if (params == null) {
    throw new Error("Race slug params are missing.");
  }

  const paramsCandidate = params as unknown;

  const paramsPromise: Promise<RaceParams> = isPromiseLike<RaceParams>(
    paramsCandidate,
  )
    ? (paramsCandidate as Promise<RaceParams>)
    : hasSlug(paramsCandidate)
      ? Promise.resolve(paramsCandidate)
      : Promise.reject(new Error("Race slug params must include a slug value."));

  const { slug } = use(paramsPromise);

  return <AdminDashboard raceSlug={slug} />;
}
