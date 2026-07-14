import { useEffect, useState } from "react";
import { getSpecialtyTagData } from "../services/specialtyTagService";
import useDocumentTitle from "../hooks/useDocumentTitle";

export default function SpecialtyTags() {
  useDocumentTitle("Specialty Tags | SugboGo Admin");

  const [specialtyTagsData, setSpecialtyTagsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSpecialtyTagsData = async () => {
      try {
        const response = await getSpecialtyTagData();
        setSpecialtyTagsData(response.data);
      } catch (fetchError) {
        setError(fetchError.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSpecialtyTagsData();
  }, []);

  if (loading) {
    return <p className="text-gray-600">Loading...</p>;
  }

  if (error) {
    return <p className="text-red-600">Error: {error}</p>;
  }

  return (
    <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
      Specialty Tags
    </h1>
  );
}
