import type { Preview } from "@storybook/react";
import { sb } from "storybook/test";
import "../styles/globals.css";

sb.mock(import("../lib/api/applications.ts"), { spy: true });
sb.mock(import("../lib/api/aiScorer.ts"), { spy: true });
sb.mock(import("../lib/api/notifications.ts"), { spy: true });
sb.mock(import("../lib/api/profiles.ts"), { spy: true });
sb.mock(import("../lib/api/proposalTemplates.ts"), { spy: true });
sb.mock(import("../lib/stellar.ts"), { spy: true });
sb.mock(import("../lib/wallet.ts"), { spy: true });
sb.mock(import("../lib/anchors.ts"), { spy: true });

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: "dark",
      values: [
        { name: "dark", value: "#0c0a06" },
        { name: "light", value: "#fafaf8" },
      ],
    },
  },
};

export default preview;
