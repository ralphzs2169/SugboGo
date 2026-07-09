import { useEffect, useState } from 'react'
import { getExplorerActivityData } from '../../services/admin-panel/explorerActivityService'
import useDocumentTitle from '../../hooks/useDocumentTitle'

export default function ExplorerActivities() {

    useDocumentTitle('Activity | SugboGo Admin')

    const [activities, setActivities] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        const fetchActivities = async () => {
            try {
                const response = await getExplorerActivityData()
                setActivities(response.data)
            } catch (fetchError) {
                setError(fetchError.message)
            } finally {
                setLoading(false)
            }
        }

        fetchActivities()
    }, [])

    if (loading) {
        return <p className="text-gray-600">Loading...</p>
    }

    if (error) {
        return <p className="text-red-600">Error: {error}</p>
    }

    return <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Explorer Activity</h1>
}
