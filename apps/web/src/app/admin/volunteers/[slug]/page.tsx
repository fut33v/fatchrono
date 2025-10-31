"use client";

import { use } from "react";
import VolunteerDashboard from "../../_components/volunteer-dashboard";

type VolunteerParams = { slug: string };

type VolunteerPageProps = {
  params?: Promise<VolunteerParams>;
};

function isPromiseLike<T>(value: unknown): value is PromiseLike<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

function hasSlug(params: unknown): params is VolunteerParams {
  return (
    typeof params === "object" &&
    params !== null &&
    "slug" in params &&
    typeof (params as { slug: unknown }).slug === "string"
  );
}

export default function VolunteerPage({ params }: VolunteerPageProps) {
  if (params == null) {
    throw new Error("Volunteer slug params are missing.");
  }

  const paramsCandidate = params as unknown;

  const paramsPromise: Promise<VolunteerParams> = isPromiseLike<VolunteerParams>(
    paramsCandidate,
  )
    ? (paramsCandidate as Promise<VolunteerParams>)
    : hasSlug(paramsCandidate)
      ? Promise.resolve(paramsCandidate)
      : Promise.reject(
          new Error("Volunteer slug params must include a slug value."),
        );

  const { slug } = use(paramsPromise);

  return <VolunteerDashboard slug={slug} />;
}
