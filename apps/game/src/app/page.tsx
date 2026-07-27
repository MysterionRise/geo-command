import { authorizeRehearsalReveal } from "./actions";
import { DemoArcade } from "../demo/demo-arcade";
import { ACTIVE_REHEARSAL_CATALOGUE } from "../demo/rehearsal-server";

export default function Page() {
  return (
    <div className="demo-page">
      <p className="demo-notice">
        <strong>{ACTIVE_REHEARSAL_CATALOGUE.notice}</strong> Five playable rounds.
      </p>
      <noscript><p className="demo-notice">CodeGuessr needs JavaScript to accept answers and reveal progressive evidence.</p></noscript>
      <DemoArcade mode={ACTIVE_REHEARSAL_CATALOGUE.mode} authorizeRevealAction={authorizeRehearsalReveal} />
    </div>
  );
}
