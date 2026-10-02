import { route } from "./router.js";
import type { StarBoxEnv } from "./types.js";

export { route };
export { parseFullName, normalizeRepository } from "./github.js";
export { truncateReadmeByParagraph } from "./routes/ai.js";

export default {
  fetch(request: Request, env: StarBoxEnv) { return route(request, env); },
};
