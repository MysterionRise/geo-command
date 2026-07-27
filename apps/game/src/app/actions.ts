"use server";

import type { RevealRequest } from "../components/arcade";
import { createDemoReveal } from "../demo/demo-game";

export async function authorizeDemoReveal(request: RevealRequest) {
  return createDemoReveal(request);
}
