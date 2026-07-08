import { useEffect, useState } from 'react'
import { getMSMEData } from '../../services/admin-panel/msmeService'

export default function Msmes() {
	const [msmesData, setMsmesData] = useState(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState(null)

	useEffect(() => {
		const fetchMsmesData = async () => {
			try {
				const response = await getMSMEData()
				setMsmesData(response.data)
			} catch (fetchError) {
				setError(fetchError.message)
			} finally {
				setLoading(false)
			}
		}

		fetchMsmesData()
	}, [])

	if (loading) {
		return <p className="text-gray-600">Loading...</p>
	}

	if (error) {
		return <p className="text-red-600">Error: {error}</p>
	}

	return <h1 className="text-3xl font-semibold tracking-tight text-slate-900">MSMEs</h1>
}
