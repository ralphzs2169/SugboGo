import { useEffect, useState } from "react";
import { getAnalyticsData } from "../services/analyticsService";
import useDocumentTitle from "../hooks/useDocumentTitle";

function Analytics() {
  useDocumentTitle("Analytics | SugboGo Admin");

  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAnalyticsData = async () => {
      try {
        const response = await getAnalyticsData();
        setAnalyticsData(response.data);
      } catch (fetchError) {
        setError(fetchError.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalyticsData();
  }, []);

  if (loading) {
    return <p className="text-gray-600">Loading...</p>;
  }

  if (error) {
    return <p className="text-red-600">Error: {error}</p>;
  }

  return (
    <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
      Analytics
    </h1>
  );
}

export default Analytics;
