import type { Meta, StoryObj } from "@storybook/react";
import { mocked } from "storybook/test";
import NotificationBell from "@/components/NotificationBell";
import { fetchNotifications } from "@/lib/api";

const mockNotifications = {
  notifications: [
    {
      id: "1",
      userAddress: "GFREELANCER123456789ABC",
      type: "job",
      title: "New job posted",
      body: "A new job is available",
      createdAt: "2026-07-28T12:00:00Z",
      read: false,
      jobId: "job-1",
    },
    {
      id: "2",
      userAddress: "GFREELANCER123456789ABC",
      type: "payment",
      title: "Payment reminder",
      body: "Your payment is due soon",
      createdAt: "2026-07-27T15:30:00Z",
      read: true,
      jobId: "job-2",
    },
  ],
  unreadCount: 1,
  nextCursor: null,
  hasMore: false,
};

const meta: Meta<typeof NotificationBell> = {
  title: "Components/NotificationBell",
  component: NotificationBell,
  parameters: {
    layout: "padded",
    backgrounds: {
      default: "dark",
    },
  },
  argTypes: {
    publicKey: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof NotificationBell>;

export const Default: Story = {
  args: {
    publicKey: "GFREELANCER123456789ABC",
  },
  beforeEach: () => {
    mocked(fetchNotifications).mockResolvedValue({ ...mockNotifications });
  },
};

export const Loading: Story = {
  args: {
    publicKey: "GFREELANCER123456789ABC",
  },
  beforeEach: () => {
    mocked(fetchNotifications).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ ...mockNotifications }), 1000);
        }),
    );
  },
};

export const Error: Story = {
  args: {
    publicKey: "GFREELANCER123456789ABC",
  },
  beforeEach: () => {
    mocked(fetchNotifications).mockRejectedValue(
      new globalThis.Error("Network error"),
    );
  },
};
