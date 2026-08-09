import { useEffect, useState } from "react";
import { getAnalyticsData } from "../services/analyticsService";
import useDocumentTitle from "@/shared/hooks/useDocumentTitle";

function BusinessApplications() {
  useDocumentTitle("Business Applications | SugboGo Admin");

  return (
    <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
      Business Applications
    </h1>
  );
}

export default BusinessApplications;
