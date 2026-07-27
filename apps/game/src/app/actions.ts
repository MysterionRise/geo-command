"use server";

import type { RevealRequest } from "../components/arcade";
import {
  ACTIVE_REHEARSAL_CATALOGUE,
  createRehearsalReveal,
} from "../demo/rehearsal-server";

export async function authorizeRehearsalReveal(request: RevealRequest) {
  return createRehearsalReveal(ACTIVE_REHEARSAL_CATALOGUE, request);
}
