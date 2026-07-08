import LoginCard from './LoginCard'
import LoginIllustration from './LoginIllustration'

export default function LoginForm() {
	return (

		<main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gray-100 px-4 py-8 text-gray-900 sm:px-6 lg:px-8">

			<div className="relative z-10 w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-[0_20px_60px_rgba(15,23,42,0.12)] ring-1 ring-gray-200/80">
				<div className="grid grid-cols-1 lg:grid-cols-[0.45fr_0.55fr]">
					<LoginIllustration />

					<section className="flex items-center justify-center px-6 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-12">
						<div className="w-full max-w-md">
							<LoginCard />
						</div>
					</section>
				</div>
			</div>
		</main>
	)
}
