import * as LottiePackage from "lottie-react";

const Lottie = LottiePackage.default.default;

/**
 * LottieAnimation component that renders a Lottie animation.
 * @param {Object} props - The component props.
 * @param {Object} props.animationData - The Lottie animation data.
 * @param {number} [props.width=180] - The width of the animation.
 * @param {number} [props.height=180] - The height of the animation.
 * @param {boolean} [props.loop=false] - Whether the animation should loop.
 * @returns {JSX.Element} The rendered Lottie animation component.
 */
export default function LottieAnimation({
  animationData,
  width = 180,
  height = 180,
  loop = false,
}) {
  return (
    <Lottie
      animationData={animationData}
      loop={loop}
      autoplay
      style={{
        width,
        height,
      }}
    />
  );
}
