import { useEffect, useState } from 'react'
import { getSuspiciousActivityData } from '../../services/admin-panel/SuspiciousActivityService'
import useDocumentTitle from '../../hooks/useDocumentTitle'

export default function SuspiciousActivities() {

	useDocumentTitle('Suspicious Activities | SugboGo Admin')

	const [suspiciousActivitiesData, setSuspiciousActivitiesData] = useState(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState(null)

	useEffect(() => {
		const fetchSuspiciousActivitiesData = async () => {
			try {
				const response = await getSuspiciousActivityData()
				setSuspiciousActivitiesData(response.data)
			} catch (fetchError) {
				setError(fetchError.message)
			} finally {
				setLoading(false)
			}
		}

		fetchSuspiciousActivitiesData()
	}, [])

	if (loading) {
		return <p className="text-gray-600">Loading...</p>
	}

	if (error) {
		return <p className="text-red-600">Error: {error}</p>
	}

	return <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Flags/Suspicious</h1>
}
