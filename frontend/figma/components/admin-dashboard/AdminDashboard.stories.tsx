import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";

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

    await expect(
      await canvas.findByText(/assigned/i)
    ).toBeInTheDocument();
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

    await expect(
      await canvas.findByText(/removed/i)
    ).toBeInTheDocument();
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

    const originalConfirm = window.confirm;
    window.confirm = () => true;

    try {
      const deleteButtons = await canvas.findAllByRole("button", { name: "Delete" });
      const enabled = deleteButtons.find((btn) => !btn.hasAttribute("disabled"));
      if (!enabled) throw new Error("No enabled Delete button found");
      await userEvent.click(enabled);

      await expect(
        await canvas.findByText(/deleted user/i)
      ).toBeInTheDocument();
    } finally {
      window.confirm = originalConfirm;
    }
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

// ─── Invitation Email — Success ───────────────────────────────────────────────

/**
 * When a user is created with status "invited", the invitation link modal
 * appears. Entering an email and clicking "Send" calls the send-email API and
 * displays a success message.
 */
export const SendInvitationEmailSuccess: Story = {
  parameters: {
    mockApi: [
      jsonRoute("GET", "/api/v1/admin/organizations", mockOrganizations),
      jsonRoute("GET", "/api/v1/admin/users", mockAdminUsers),
      jsonRoute("GET", "/api/v1/admin/roles", mockAdminRoles),
      jsonRoute("GET", "/api/v1/admin/operations", mockAdminOperations),
      jsonRoute("POST", "/api/v1/admin/users", {
        id: "new-user-id",
        email: "invited@example.com",
        full_name: "Bob Invited",
        status: "invited",
        organization_id: mockOrganizations[0].id,
        created_at: new Date().toISOString(),
        roles: ["lawyer"],
        invitation_url: "http://localhost:3000/invite?token=test-token-abc123",
      }),
      jsonRoute("POST", "/api/v1/admin/send-invitation-email", {}, 204),
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(await canvas.findByRole("button", { name: "Members" }));
    await canvas.findByRole("heading", { name: "Create User" });

    await userEvent.type(canvas.getByPlaceholderText("first@example.com"), "invited@example.com");
    await userEvent.type(canvas.getByPlaceholderText("First"), "Bob");
    await userEvent.type(canvas.getByPlaceholderText("Last"), "Invited");

    await userEvent.selectOptions(
      canvas.getAllByRole("combobox").find((el) => el.textContent?.includes("Active"))!,
      "invited"
    );

    await userEvent.click(canvas.getByRole("button", { name: "Create User" }));

    await canvas.findByRole("heading", { name: "Confirm Create User" });
    await userEvent.click(canvas.getByRole("button", { name: "Create" }));

    await canvas.findByRole("heading", { name: "Invitation link ready" });

    await userEvent.type(canvas.getByPlaceholderText("recipient@example.com"), "recipient@example.com");
    await userEvent.click(canvas.getByRole("button", { name: "Send" }));

    await expect(
      await canvas.findByText("Email sent successfully.")
    ).toBeInTheDocument();
  },
};

// ─── Invitation Email — Error ─────────────────────────────────────────────────

/**
 * When the send-invitation-email endpoint returns an error, the modal shows
 * an inline error message so the admin can copy the link manually instead.
 */
export const SendInvitationEmailError: Story = {
  parameters: {
    mockApi: [
      jsonRoute("GET", "/api/v1/admin/organizations", mockOrganizations),
      jsonRoute("GET", "/api/v1/admin/users", mockAdminUsers),
      jsonRoute("GET", "/api/v1/admin/roles", mockAdminRoles),
      jsonRoute("GET", "/api/v1/admin/operations", mockAdminOperations),
      jsonRoute("POST", "/api/v1/admin/users", {
        id: "new-user-id-2",
        email: "invited2@example.com",
        full_name: "Carol Invited",
        status: "invited",
        organization_id: mockOrganizations[0].id,
        created_at: new Date().toISOString(),
        roles: ["lawyer"],
        invitation_url: "http://localhost:3000/invite?token=test-token-xyz789",
      }),
      jsonRoute("POST", "/api/v1/admin/send-invitation-email", { detail: "SMTP not configured" }, 503),
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(await canvas.findByRole("button", { name: "Members" }));
    await canvas.findByRole("heading", { name: "Create User" });

    await userEvent.type(canvas.getByPlaceholderText("first@example.com"), "invited2@example.com");
    await userEvent.type(canvas.getByPlaceholderText("First"), "Carol");
    await userEvent.type(canvas.getByPlaceholderText("Last"), "Invited");

    await userEvent.selectOptions(
      canvas.getAllByRole("combobox").find((el) => el.textContent?.includes("Active"))!,
      "invited"
    );

    await userEvent.click(canvas.getByRole("button", { name: "Create User" }));
    await canvas.findByRole("heading", { name: "Confirm Create User" });
    await userEvent.click(canvas.getByRole("button", { name: "Create" }));

    await canvas.findByRole("heading", { name: "Invitation link ready" });

    await userEvent.type(canvas.getByPlaceholderText("recipient@example.com"), "recipient@example.com");
    await userEvent.click(canvas.getByRole("button", { name: "Send" }));

    await expect(
      await canvas.findByText(/request failed: 503/i)
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(canvas.getByDisplayValue("http://localhost:3000/invite?token=test-token-xyz789")).toBeInTheDocument();
    });
  },
};
