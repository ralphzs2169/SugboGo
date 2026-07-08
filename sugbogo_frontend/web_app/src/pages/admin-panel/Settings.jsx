import { useEffect, useState } from 'react'
import { getSettingsData } from '../../services/admin-panel/settingsService'

export default function Settings() {
	const [settingsData, setSettingsData] = useState(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState(null)

	useEffect(() => {
		const fetchSettingsData = async () => {
			try {
				const response = await getSettingsData()
				setSettingsData(response.data)
			} catch (fetchError) {
				setError(fetchError.message)
			} finally {
				setLoading(false)
			}
		}

		fetchSettingsData()
	}, [])

	if (loading) {
		return <p className="text-gray-600">Loading...</p>
	}

	if (error) {
		return <p className="text-red-600">Error: {error}</p>
	}

	return <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Settings</h1>
}
