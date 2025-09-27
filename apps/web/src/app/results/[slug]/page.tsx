"use client";

import { useParams } from "next/navigation";
import ResultsPage from "@/app/results/page";
import { useRaceStore } from "@/store/race-store";

export default function ResultsByRacePage() {
  const params = useParams<{ slug: string }>();
  const setError = useRaceStore((state) => state.setError);

  if (!params?.slug) {
    setError("Гонка не найдена");
  }

  return <ResultsPage />;
}
