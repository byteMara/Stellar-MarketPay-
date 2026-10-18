import type { Meta, StoryObj } from "@storybook/react";
import { mocked, userEvent, within } from "storybook/test";
import ApplicationForm from "@/components/ApplicationForm";
import { ToastProvider } from "@/components/Toast";
import {
  fetchProposalTemplates,
  scoreProposal,
  submitApplication,
} from "@/lib/api";
import type { Job } from "@/utils/types";

const publicKey = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const proposal =
  "I have extensive experience building reliable web applications and can deliver this project with clear communication, thoughtful testing, and maintainable code. I will begin by confirming requirements, then share progress regularly and incorporate feedback throughout implementation. Additionally, I will document key decisions, share a clear delivery timeline, raise risks early, and make sure the final experience works well across screen sizes and assistive technologies. I value dependable collaboration and will remain available for adjustments after handoff.";
const job: Job = {
  id: "job-story-1880",
  title: "Build a marketplace dashboard",
  description:
    "Create a responsive marketplace dashboard for independent workers.",
  budget: "250",
  currency: "XLM",
  category: "Development",
  skills: ["React", "TypeScript"],
  status: "open",
  clientAddress: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
  applicantCount: 4,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const meta: Meta<typeof ApplicationForm> = {
  title: "Forms/ApplicationForm",
  component: ApplicationForm,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <ToastProvider>
        <Story />
      </ToastProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ApplicationForm>;

function setupMocks() {
  mocked(fetchProposalTemplates).mockResolvedValue([]);
  mocked(scoreProposal).mockResolvedValue({
    data: null,
    warning: "Proposal scoring is unavailable right now. You can still submit.",
  });
  mocked(submitApplication).mockImplementation(async () => {
    throw new globalThis.Error("Mock application submission failed.");
  });
}

export const Default: Story = {
  args: {
    job,
    publicKey,
    prefillData: { bidAmount: "200", message: proposal },
  },
  beforeEach: setupMocks,
};

export const ValidationError: Story = {
  args: {
    job,
    publicKey,
    prefillData: {
      bidAmount: "0",
      message: "I would love to work on this project.",
    },
  },
  beforeEach: setupMocks,
};

export const Submitting: Story = {
  args: {
    job,
    publicKey,
    prefillData: { bidAmount: "200", message: proposal },
  },
  beforeEach: () => {
    setupMocks();
    mocked(submitApplication).mockImplementation(() => new Promise(() => {}));
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole("button", { name: "Submit Proposal" }),
    );
    await canvas.findByRole("button", { name: "Submitting..." });
  },
};
