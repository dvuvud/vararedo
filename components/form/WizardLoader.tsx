"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Guiden läser sparat utkast från localStorage vid start, därför renderas den bara i webbläsaren.
const PlanWizard = dynamic(() => import("./PlanWizard"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center py-20">
      <Loader2 aria-hidden className="size-8 animate-spin text-primary" />
    </div>
  ),
});

export default PlanWizard;
