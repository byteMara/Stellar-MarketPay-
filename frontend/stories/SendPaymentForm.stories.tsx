import type { Meta, StoryObj } from "@storybook/react";
import { mocked, userEvent, within } from "storybook/test";
import SendPaymentForm from "@/components/SendPaymentForm";
import {
  buildPaymentTransaction,
  checkDestinationAccount,
  submitTransaction,
} from "@/lib/stellar";
import { signTransactionWithWallet } from "@/lib/wallet";

const meta: Meta<typeof SendPaymentForm> = {
  title: "Forms/SendPaymentForm",
  component: SendPaymentForm,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof SendPaymentForm>;

const fromPublicKey =
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const toPublicKey = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

function setupMocks() {
  mocked(checkDestinationAccount).mockResolvedValue({ exists: true });
  mocked(buildPaymentTransaction).mockResolvedValue({
    toXDR: () => "mock-transaction-xdr",
  } as Awaited<ReturnType<typeof buildPaymentTransaction>>);
  mocked(signTransactionWithWallet).mockResolvedValue({
    signedXDR: "mock-signed-transaction-xdr",
    error: null,
  });
  mocked(submitTransaction).mockResolvedValue({
    hash: "mock-transaction-hash",
    successful: true,
  });
}

export const Default: Story = {
  args: { fromPublicKey },
  beforeEach: setupMocks,
};

export const ValidationError: Story = {
  args: { fromPublicKey },
  beforeEach: setupMocks,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByLabelText("Recipient address"),
      "not-a-stellar-address",
    );
    await canvas.findByText("Not a valid Stellar address");
  },
};

export const Submitting: Story = {
  args: { fromPublicKey },
  beforeEach: () => {
    setupMocks();
    mocked(checkDestinationAccount).mockImplementation(
      () => new Promise(() => {}),
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByLabelText("Recipient address"),
      toPublicKey,
    );
    await userEvent.type(canvas.getByLabelText("Amount (XLM)"), "25");
    await userEvent.click(canvas.getByRole("button", { name: "Send XLM" }));
    await canvas.findByRole("button", { name: "Sending…" });
  },
};
