export default function SugboGoText({ className = '', includeAdmin = false }) {
	return (
		<span className={className}>
			<span className="text-primary">Sugbo</span>
			<span className="text-gray-900">Go</span>
			{includeAdmin ? ' Admin' : ''}
		</span>
	)
}