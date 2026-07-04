import { useEffect, useState } from 'react'
import { getRolesPermissionsData } from '../../services/adminPanel/rolesPermissionsService'

export default function RolesPermissions() {
  const [rolesPermissionsData, setRolesPermissionsData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchRolesPermissionsData = async () => {
      try {
        const response = await getRolesPermissionsData()
        setRolesPermissionsData(response.data)
      } catch (fetchError) {
        setError(fetchError.message)
      } finally {
        setLoading(false)
      }
    }

    fetchRolesPermissionsData()
  }, [])

  if (loading) {
    return <p className="text-gray-600">Loading...</p>
  }

  if (error) {
    return <p className="text-red-600">Error: {error}</p>
  }

  return <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Roles & Permissions</h1>
}