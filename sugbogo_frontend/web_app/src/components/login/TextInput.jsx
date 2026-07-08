export default function TextInput({ id, name, label, type = 'text', autoComplete, placeholder }) {
	return (
		<div>
			<label htmlFor={id} className="mb-2 block text-sm font-medium text-gray-700">
				{label}
			</label>
			<input
				id={id}
				name={name}
				type={type}
				autoComplete={autoComplete}
				placeholder={placeholder}
				className="w-full rounded-md border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-primary focus:ring-4 focus:ring-primary/15"
			/>
		</div>
	)
}