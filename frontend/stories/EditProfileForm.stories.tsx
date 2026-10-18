import type { Meta, StoryObj } from "@storybook/react";
import { mocked, userEvent, within } from "storybook/test";
import EditProfileForm from "@/components/EditProfileForm";
import {
  fetchProfile,
  updateProfileAvailability,
  upsertProfile,
} from "@/lib/api";
import type { UserProfile } from "@/utils/types";

const publicKey = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const profile: UserProfile = {
  publicKey,
  displayName: "Mara Designer",
  bio: "Product designer and frontend developer.",
  role: "freelancer",
  skills: ["React", "Figma"],
  portfolioItems: [],
  portfolioFiles: [],
  availability: { status: "available" },
  completedJobs: 3,
  totalEarnedXLM: "1200",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const meta: Meta<typeof EditProfileForm> = {
  title: "Forms/EditProfileForm",
  component: EditProfileForm,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof EditProfileForm>;

function setupMocks() {
  mocked(fetchProfile).mockResolvedValue(profile);
  mocked(upsertProfile).mockResolvedValue(profile);
  mocked(updateProfileAvailability).mockResolvedValue(profile);
}

export const Default: Story = {
  args: { publicKey },
  beforeEach: setupMocks,
};

export const ValidationError: Story = {
  args: { publicKey },
  beforeEach: setupMocks,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole("button", { name: "Add Item" }),
    );
    await userEvent.click(canvas.getByRole("button", { name: "Save Profile" }));
    await canvas.findByText(
      "Each portfolio item needs a title, type, and URL or transaction ID.",
    );
  },
};

export const Submitting: Story = {
  args: { publicKey },
  beforeEach: () => {
    setupMocks();
    mocked(upsertProfile).mockImplementation(() => new Promise(() => {}));
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole("button", { name: "Save Profile" }),
    );
    await canvas.findByRole("button", { name: "Saving..." });
  },
};
