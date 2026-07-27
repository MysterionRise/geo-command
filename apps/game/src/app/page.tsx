import { authorizeDemoReveal } from "./actions";
import { DemoArcade } from "../demo/demo-arcade";
import { DEMO_MODE } from "../demo/demo-game";

export default function Page() {
  return (
    <div className="demo-page">
      <p className="demo-notice"><strong>Synthetic local demo.</strong> Five playable rounds; not an approved beta corpus.</p>
      <noscript><p className="demo-notice">CodeGuessr needs JavaScript to accept answers and reveal progressive evidence.</p></noscript>
      <DemoArcade mode={DEMO_MODE} authorizeRevealAction={authorizeDemoReveal} />
    </div>
  );
}
