import { canonicalSha256 } from "../policy/policy-register";

export const ACQUISITION_TOOL_ID = "codeguessr-github-acquirer";
export const ACQUISITION_TOOL_VERSION = "1.0.0";
export const ACQUISITION_TOOL_HASH = canonicalSha256({
  id: ACQUISITION_TOOL_ID,
  version: ACQUISITION_TOOL_VERSION,
  components: [
    "immutable-subtree-v1",
    "blob-screen-v1",
    "line-sequence-v1",
    "draft-v1",
  ],
});
