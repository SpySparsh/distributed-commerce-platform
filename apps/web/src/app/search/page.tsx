"use client";

import { Suspense } from "react";
import SearchResults from "../../legacy-pages/SearchResults.jsx";

export default function SearchPage() {
  return (
    <Suspense fallback={<p className="p-6">Loading search...</p>}>
      <SearchResults />
    </Suspense>
  );
}
