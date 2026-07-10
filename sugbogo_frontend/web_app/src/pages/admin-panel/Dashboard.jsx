import { useEffect, useState } from "react";
import { getDashboardData } from "../../services/admin-panel/dashboardService";
import useDocumentTitle from "../../hooks/useDocumentTitle";
import MetricRow from "../../components/admin-panel/dashboard/MetricRow";
import DiscoveryActivity from "../../components/admin-panel/dashboard/DiscoveryActivity";
import LowerDashboardSection from "../../components/admin-panel/dashboard/LowerDashboardSection";

export default function Dashboard() {
  useDocumentTitle("Dashboard | SugboGo Admin");

  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await getDashboardData();
        setDashboardData(response.data);
      } catch (fetchError) {
        setError(fetchError.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return <p className="text-gray-600">Loading...</p>;
  }

  if (error) {
    return <p className="text-red-600">Error: {error}</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <MetricRow />
      <DiscoveryActivity />

      <LowerDashboardSection />
    </div>
  );
}
