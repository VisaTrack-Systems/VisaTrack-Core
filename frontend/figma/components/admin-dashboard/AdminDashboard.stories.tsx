import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";

import { AdminDashboard } from "../AdminDashboard";
import {
  mockAdminOperations,
  mockAdminRoles,
  mockAdminUsers,
  mockCurrentUserAdmin,
  mockOrganizations,
} from "../../storybook/fixtures";
import { jsonRoute } from "../../storybook/mockApi";

const meta = {
  title: "Components/Admin Dashboard",
  component: AdminDashboard,
  parameters: {
    layout: "fullscreen",
    mockApi: [
      jsonRoute("GET", "/api/v1/admin/organizations", mockOrganizations),
      jsonRoute("GET", "/api/v1/admin/users", mockAdminUsers),
      jsonRoute("GET", "/api/v1/admin/roles", mockAdminRoles),
      jsonRoute("GET", "/api/v1/admin/operations", mockAdminOperations),
    ],
  },
} satisfies Meta<typeof AdminDashboard>;

export default meta;

type Story = StoryObj<typeof meta>;

// Clicking "Add" in the Manage Roles column opens the Assign Role confirmation dialog.
export const AssignRoleConfirmation: Story = {
  args: { currentUser: mockCurrentUserAdmin },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await canvas.findByRole("heading", { name: "All Users" });

    const addButtons = canvas.getAllByRole("button", { name: "Add" });
    await userEvent.click(addButtons[0]);

    await expect(
      await canvas.findByRole("heading", { name: "Assign Role" }),
    ).toBeInTheDocument();
  },
};

// Clicking a role badge opens the Remove Role confirmation dialog.
export const RemoveRoleConfirmation: Story = {
  args: { currentUser: mockCurrentUserAdmin },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await canvas.findByRole("heading", { name: "All Users" });

    await userEvent.click(canvas.getByRole("button", { name: "lawyer ×" }));

    await expect(
      await canvas.findByRole("heading", { name: "Remove Role" }),
    ).toBeInTheDocument();
  },
};

// Clicking "Delete" in the Actions column opens the Delete User confirmation dialog.
export const DeleteUserConfirmation: Story = {
  args: { currentUser: mockCurrentUserAdmin },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await canvas.findByRole("heading", { name: "All Users" });

    const deleteButtons = canvas.getAllByRole("button", { name: "Delete" });
    await userEvent.click(deleteButtons[0]);

    await expect(
      await canvas.findByRole("heading", { name: "Delete User" }),
    ).toBeInTheDocument();
  },
};
