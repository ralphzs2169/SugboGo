import PasswordInput from './PasswordInput'
import SugboGoText from '../SugboGoText'
import TextInput from './TextInput'

export default function LoginCard() {
	return (
		<article className="rounded-2xl bg-white p-0">
			<div className="mb-8">
			

				<h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-3xl">
					Welcome to <SugboGoText includeAdmin />
				</h1>
				<p className="mt-2 text-sm text-gray-500">Admin Dashboard</p>
			</div>

			<form className="space-y-6" onSubmit={(event) => event.preventDefault()}>
				<div className="space-y-4">
					<TextInput
						id="identifier"
						name="identifier"
						label="Email/Username"
						autoComplete="username"
						placeholder="admin@example.com"
					/>

					<PasswordInput
						id="password"
						name="password"
						label="Password"
						autoComplete="current-password"
						placeholder="Enter your password"
					/>
				</div>

				<div className="flex items-center justify-between gap-4 text-sm">
					<label htmlFor="remember-me" className="flex select-none items-center gap-2 text-gray-600">
						<input
							id="remember-me"
							name="remember-me"
							type="checkbox"
							className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
						/>
						<span>Remember Me</span>
					</label>

					<a
						href="#forgot-password"
						className="font-medium text-primary transition hover:opacity-80 focus:outline-none focus-visible:text-primary"
					>
						Forgot Password?
					</a>
				</div>

				<button
					type="submit"
					className="flex w-full items-center justify-center rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white transition duration-200 hover:brightness-95 active:translate-y-px focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/25"
				>
					Login
				</button>
			</form>
		</article>
	)
}