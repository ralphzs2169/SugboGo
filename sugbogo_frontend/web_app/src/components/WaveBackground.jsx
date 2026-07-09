function WaveBackground({ className = '' }) {
	return (
		<svg
			className={className}
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 1440 320"
			preserveAspectRatio="none"
		>
			<path
				className="fill-gray-300"
				d="M0,192L40,186.7C80,181,160,171,240,149.3C320,128,400,96,480,101.3C560,107,640,149,720,186.7C800,224,880,256,960,240C1040,224,1120,160,1200,138.7C1280,117,1360,139,1400,149.3L1440,160L1440,320L1400,320C1360,320,1280,320,1200,320C1120,320,1040,320,960,320C880,320,800,320,720,320C640,320,560,320,480,320C400,320,320,320,240,320C160,320,80,320,40,320L0,320Z"
			/>
		</svg>
	)
}

export default WaveBackground