import { useEffect, useState } from "react";
import { getUserData } from "../services/userService";
import useDocumentTitle from "@/shared/hooks/useDocumentTitle";

export default function Users() {
  useDocumentTitle("Users | SugboGo Admin");

  const [usersData, setUsersData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUsersData = async () => {
      try {
        const response = await getUserData();
        setUsersData(response.data);
      } catch (fetchError) {
        setError(fetchError.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUsersData();
  }, []);

  if (loading) {
    return <p className="text-gray-600">Loading...</p>;
  }

  if (error) {
    return <p className="text-red-600">Error: {error}</p>;
  }

  return (
    <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
      Users
    </h1>
  );
}
