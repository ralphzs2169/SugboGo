import { useEffect, useState } from 'react'
import { getDashboardData } from '../../services/admin-panel/dashboardService'
import useDocumentTitle from '../../hooks/useDocumentTitle'

export default function Dashboard() {

	useDocumentTitle('Dashboard | SugboGo Admin')

	const [dashboardData, setDashboardData] = useState(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState(null)

	useEffect(() => {
		const fetchDashboardData = async () => {
			try {
				const response = await getDashboardData()
				setDashboardData(response.data)
			} catch (fetchError) {
				setError(fetchError.message)
			} finally {
				setLoading(false)
			}
		}

		fetchDashboardData()
	}, [])

	if (loading) {
		return <p className="text-gray-600">Loading...</p>
	}

	if (error) {
		return <p className="text-red-600">Error: {error}</p>
	}

	return <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
}
