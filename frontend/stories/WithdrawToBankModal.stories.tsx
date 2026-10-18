import type { Meta, StoryObj } from "@storybook/react";
import { mocked, userEvent, within } from "storybook/test";
import WithdrawToBankModal from "@/components/WithdrawToBankModal";
import { ToastProvider } from "@/components/Toast";
import { fetchAnchorEndpoints, startInteractiveWithdraw } from "@/lib/anchors";

const meta: Meta<typeof WithdrawToBankModal> = {
  title: "Forms/WithdrawToBankModal",
  component: WithdrawToBankModal,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <ToastProvider>
        <Story />
      </ToastProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof WithdrawToBankModal>;

function setupMocks() {
  mocked(fetchAnchorEndpoints).mockResolvedValue({
    homeDomain: "anchor.example",
    webAuthEndpoint: "https://anchor.example/auth",
    transferServerSep24: "https://anchor.example/sep24",
    directPaymentServer: null,
    signingKey: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    currencies: [{ code: "USDC" }, { code: "XLM" }],
  });
  mocked(startInteractiveWithdraw).mockResolvedValue({
    type: "interactive_customer_info_needed",
    id: "withdrawal-story-id",
    url: "https://anchor.example/withdraw",
  });
}

const args = {
  publicKey: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  onClose: () => {},
};

export const Default: Story = {
  args,
  beforeEach: setupMocks,
};

export const ValidationError: Story = {
  args,
  beforeEach: setupMocks,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole("button", { name: "Continue" }),
    );
    await canvas.findByText("Enter an amount greater than 0.");
  },
};

export const Submitting: Story = {
  args,
  beforeEach: () => {
    setupMocks();
    mocked(startInteractiveWithdraw).mockImplementation(
      () => new Promise(() => {}),
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText("Amount"), "100");
    await userEvent.click(canvas.getByRole("button", { name: "Continue" }));
    await canvas.findByText("Authenticating with the anchor…");
  },
};
