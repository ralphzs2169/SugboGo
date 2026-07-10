import { useEffect, useState } from "react";
import { getMSMEData } from "../../services/admin-panel/msmeService";
import useDocumentTitle from "../../hooks/useDocumentTitle";
import MetricRow from "../../components/admin-panel/MetricRow";
import MsmeTable from "../../components/admin-panel/msme/MsmeTable";

export default function Msmes() {
  useDocumentTitle("MSMEs | SugboGo Admin");

  const [msmesData, setMsmesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMsmesData = async () => {
      try {
        const response = await getMSMEData();
        setMsmesData(response.data);
      } catch (fetchError) {
        setError(fetchError.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMsmesData();
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
      <MsmeTable />
    </div>
  );
}
