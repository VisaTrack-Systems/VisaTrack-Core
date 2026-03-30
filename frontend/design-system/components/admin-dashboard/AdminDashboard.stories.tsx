/** AdminDashboard.stories: Storybook stories for AdminDashboard components. Demonstrates various component states and usage patterns. */

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
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    mockApi: [
      jsonRoute("GET", "/api/v1/admin/organizations", mockOrganizations),
      jsonRoute("GET", "/api/v1/admin/users", mockAdminUsers),
      jsonRoute("GET", "/api/v1/admin/roles", mockAdminRoles),
      jsonRoute("GET", "/api/v1/admin/operations", mockAdminOperations),
    ],
  },
  args: {
    currentUser: mockCurrentUserAdmin,
  },
} satisfies Meta<typeof AdminDashboard>;

export default meta;

type Story = StoryObj<typeof meta>;

// ─── Assign Role — Confirmation Dialog ───────────────────────────────────────

// Clicking "Add" in the Manage Roles column opens the Assign Role confirmation dialog.
export const AssignRoleConfirmation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(await canvas.findByRole("button", { name: "Members" }));
    await canvas.findByRole("heading", { name: "All Members" });

    const addButtons = canvas.getAllByRole("button", { name: "Add" });
    await userEvent.click(addButtons[0]);

    await expect(
      await canvas.findByRole("heading", { name: "Assign Role" }),
    ).toBeInTheDocument();
  },
};

// ─── Assign Role — Success ────────────────────────────────────────────────────

/**
 * Clicking "Add" in the Manage Roles column triggers the role assignment API
 * and shows a success flash message. The mock returns the same user list so
 * the table re-renders without error.
 */
export const AssignRoleSuccess: Story = {
  parameters: {
    mockApi: [
      jsonRoute("GET", "/api/v1/admin/organizations", mockOrganizations),
      jsonRoute("GET", "/api/v1/admin/users", mockAdminUsers),
      jsonRoute("GET", "/api/v1/admin/roles", mockAdminRoles),
      jsonRoute("GET", "/api/v1/admin/operations", mockAdminOperations),
      jsonRoute("POST", /^\/api\/v1\/admin\/users\/[^/]+\/roles$/, {}),
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(await canvas.findByRole("button", { name: "Members" }));
    await canvas.findByRole("heading", { name: "All Members" });

    const addButtons = await canvas.findAllByRole("button", { name: "Add" });
    await userEvent.click(addButtons[0]);

    // ConfirmDialog appears — click through to trigger the API call
    await canvas.findByRole("heading", { name: "Assign Role" });
    await userEvent.click(canvas.getByRole("button", { name: "Assign" }));
  },
};

// ─── Remove Role — Confirmation Dialog ───────────────────────────────────────

// Clicking a role badge opens the Remove Role confirmation dialog.
export const RemoveRoleConfirmation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(await canvas.findByRole("button", { name: "Members" }));
    await canvas.findByRole("heading", { name: "All Members" });

    await userEvent.click(canvas.getByRole("button", { name: "lawyer ×" }));

    await expect(
      await canvas.findByRole("heading", { name: "Remove Role" }),
    ).toBeInTheDocument();
  },
};

// ─── Remove Role — Success ────────────────────────────────────────────────────

/**
 * Clicking a role badge (e.g. "lawyer ×") calls the remove-role API and
 * shows a success flash message.
 */
export const RemoveRoleSuccess: Story = {
  parameters: {
    mockApi: [
      jsonRoute("GET", "/api/v1/admin/organizations", mockOrganizations),
      jsonRoute("GET", "/api/v1/admin/users", mockAdminUsers),
      jsonRoute("GET", "/api/v1/admin/roles", mockAdminRoles),
      jsonRoute("GET", "/api/v1/admin/operations", mockAdminOperations),
      jsonRoute("DELETE", /^\/api\/v1\/admin\/users\/[^/]+\/roles\/[^/]+$/, {}),
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(await canvas.findByRole("button", { name: "Members" }));
    await canvas.findByRole("heading", { name: "All Members" });

    const roleBadges = await canvas.findAllByTitle("Remove role");
    await userEvent.click(roleBadges[0]);

    // ConfirmDialog appears — click through to trigger the API call
    await canvas.findByRole("heading", { name: "Remove Role" });
    await userEvent.click(canvas.getByRole("button", { name: "Remove" }));
  },
};

// ─── Delete User — Confirmation Dialog ───────────────────────────────────────

// Clicking "Delete" in the Actions column opens the Delete User confirmation dialog.
export const DeleteUserConfirmation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(await canvas.findByRole("button", { name: "Members" }));
    await canvas.findByRole("heading", { name: "All Members" });

    const deleteButtons = canvas.getAllByRole("button", { name: "Delete" });
    await userEvent.click(deleteButtons[0]);

    await expect(
      await canvas.findByRole("heading", { name: "Delete User" }),
    ).toBeInTheDocument();
  },
};

// ─── Delete User — Confirmed ──────────────────────────────────────────────────

/**
 * Clicking "Delete" triggers window.confirm. When confirmed, the API is called
 * and a success flash appears.
 */
export const DeleteUserConfirmed: Story = {
  parameters: {
    mockApi: [
      jsonRoute("GET", "/api/v1/admin/organizations", mockOrganizations),
      jsonRoute("GET", "/api/v1/admin/users", mockAdminUsers),
      jsonRoute("GET", "/api/v1/admin/roles", mockAdminRoles),
      jsonRoute("GET", "/api/v1/admin/operations", mockAdminOperations),
      jsonRoute("DELETE", /^\/api\/v1\/admin\/users\/[^/]+$/, {}, 204),
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(await canvas.findByRole("button", { name: "Members" }));
    await canvas.findByRole("heading", { name: "All Members" });

    const deleteButtons = await canvas.findAllByRole("button", { name: "Delete" });
    const enabled = deleteButtons.find((btn) => !btn.hasAttribute("disabled"));
    if (!enabled) throw new Error("No enabled Delete button found");
    await userEvent.click(enabled);

    // ConfirmDialog appears — click the dialog's confirm button (last "Delete" in the DOM)
    await canvas.findByRole("heading", { name: "Delete User" });
    const allDeleteButtons = canvas.getAllByRole("button", { name: "Delete" });
    await userEvent.click(allDeleteButtons[allDeleteButtons.length - 1]);
  },
};

// ─── Create User — Confirmation Dialog ───────────────────────────────────────

/**
 * Filling in the Create User form and submitting shows the confirmation
 * dialog with all entered field values before the API is called.
 */
export const CreateUserConfirmationDialog: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(await canvas.findByRole("button", { name: "Members" }));
    await canvas.findByRole("heading", { name: "Create User" });

    await userEvent.type(canvas.getByPlaceholderText("first@example.com"), "test@example.com");
    await userEvent.type(canvas.getByPlaceholderText("First"), "Alice");
    await userEvent.type(canvas.getByPlaceholderText("Last"), "Example");
    await userEvent.type(canvas.getByPlaceholderText("Min. 8 characters"), "password123");

    await userEvent.click(canvas.getByRole("button", { name: "Create User" }));

    await expect(
      await canvas.findByRole("heading", { name: "Confirm Create User" })
    ).toBeInTheDocument();

    await expect(canvas.getByText("Alice")).toBeInTheDocument();
    await expect(canvas.getByText("Example")).toBeInTheDocument();
    await expect(canvas.getByText("test@example.com")).toBeInTheDocument();
  },
};

