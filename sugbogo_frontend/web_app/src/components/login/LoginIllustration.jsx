import adminLoginIllustration from '../../assets/illustrations/admin-login.svg'
import SugboGoText from '../SugboGoText'

function LoginIllustration() {
	return (
		<section className="relative flex items-center justify-center bg-gray-50 px-6 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-12">
			<div className="absolute left-6 top-6 flex items-center gap-3 sm:left-8 sm:top-8 lg:left-10 lg:top-10">
				<span
					aria-hidden="true"
					className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary"
				>
					SG
				</span>

				<p className="text-base font-bold text-gray-900">
					<SugboGoText includeAdmin />
				</p>
			</div>

			<img
				src={adminLoginIllustration}
				alt="Admin login illustration"
				className="h-auto w-full max-w-[430px] object-contain"
			/>
		</section>
	)
}

export default LoginIllustration