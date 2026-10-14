"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Profilen ligger i localStorage, därför renderas resultatet bara i webbläsaren.
const ResultView = dynamic(() => import("./ResultView"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center py-20">
      <Loader2 aria-hidden className="size-8 animate-spin text-primary" />
    </div>
  ),
});

export default ResultView;
