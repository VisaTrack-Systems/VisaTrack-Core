/** ui.stories: Storybook stories for the shared UI primitives. Shows every variant and checks that native props pass through. */

import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  FieldHint,
  Input,
  Label,
  Select,
  Table,
  TableBody,
  TableHead,
  TableRow,
  Td,
  Textarea,
  Th,
} from './ui';

const StoryHost = () => null;

const meta = {
  title: 'Design System/Primitives',
  component: StoryHost,
  tags: ['autodocs'],
} satisfies Meta<typeof StoryHost>;

export default meta;

type Story = StoryObj<typeof meta>;

const primaryClick = fn();
const disabledClick = fn();

export const Buttons: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button onClick={primaryClick}>Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Delete</Button>
      <Button size="sm">Small</Button>
      <Button disabled onClick={disabledClick}>Disabled</Button>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Primary' }));
    await expect(primaryClick).toHaveBeenCalledTimes(1);
    await expect(canvas.getByRole('button', { name: 'Disabled' })).toBeDisabled();
  },
};

export const FormFields: Story = {
  render: () => (
    <form className="max-w-sm space-y-4" onSubmit={(event) => event.preventDefault()}>
      <div>
        <Label htmlFor="ui-org">Organization slug</Label>
        <Input id="ui-org" placeholder="acme-law" />
      </div>
      <div>
        <Label htmlFor="ui-email">Email</Label>
        <Input id="ui-email" type="email" aria-invalid="true" defaultValue="not-an-email" />
        <FieldHint error>Enter a valid email address.</FieldHint>
      </div>
      <div>
        <Label htmlFor="ui-type">Case type</Label>
        <Select id="ui-type" defaultValue="study">
          <option value="study">Study permit</option>
          <option value="work">Work permit</option>
        </Select>
      </div>
      <div>
        <Label htmlFor="ui-notes">Notes</Label>
        <Textarea id="ui-notes" rows={3} />
        <FieldHint>Visible to your organization only.</FieldHint>
      </div>
      <Button type="submit">Save</Button>
    </form>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const org = canvas.getByLabelText('Organization slug');
    await userEvent.type(org, 'acme');
    await expect(org).toHaveValue('acme');
    await expect(canvas.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    await expect(canvas.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'submit');
  },
};

export const CardsBadgesAndAlerts: Story = {
  render: () => (
    <div className="max-w-2xl space-y-4">
      <Card>
        <CardHeader
          title="Active cases"
          description="Cases assigned to you"
          actions={<Button size="sm" variant="secondary">View all</Button>}
        />
        <CardBody className="flex flex-wrap gap-2">
          <Badge>Draft</Badge>
          <Badge tone="primary">In review</Badge>
          <Badge tone="success">Approved</Badge>
          <Badge tone="warning">Awaiting documents</Badge>
          <Badge tone="danger">Overdue</Badge>
        </CardBody>
      </Card>
      <Alert tone="primary">Your organization has 3 pending invitations.</Alert>
      <Alert tone="warning">Two documents expire this week.</Alert>
      <Alert tone="danger">Failed to load cases.</Alert>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('alert')).toHaveTextContent('Failed to load cases.');
  },
};

export const DataTable: Story = {
  render: () => (
    <Table>
      <TableHead>
        <tr>
          <Th>Case</Th>
          <Th>Client</Th>
          <Th>Status</Th>
          <Th className="text-right">Updated</Th>
        </tr>
      </TableHead>
      <TableBody>
        <TableRow>
          <Td className="font-medium text-gray-900">VT-1042</Td>
          <Td>Elena Park</Td>
          <Td><Badge tone="primary">In review</Badge></Td>
          <Td className="text-right">2 hours ago</Td>
        </TableRow>
        <TableRow>
          <Td className="font-medium text-gray-900">VT-1038</Td>
          <Td>Omar Haddad</Td>
          <Td><Badge tone="warning">Awaiting documents</Badge></Td>
          <Td className="text-right">Yesterday</Td>
        </TableRow>
      </TableBody>
    </Table>
  ),
};
