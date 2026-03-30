# Meeting Documentation

This directory maintains records of all project meetings, including design discussions, requirement refinements, development decisions, and client feedback sessions. Meeting notes provide historical context for architectural choices, help onboard new team members, and create an audit trail of project decisions for academic evaluation.

## Organization

- **templates/** - Meeting note templates for consistent documentation
- **group-meetings/** - Internal team meetings (standup, design review, retrospectives)
- **client-meetings/** - Client/stakeholder meetings (requirements, feedback, demos)

## Filing Guidelines

### Naming Convention

Use `YYYY-MM-DD_title.md` format:
- `2026-03-30_kickoff.md` - Team kickoff meeting
- `2026-03-15_requirements_review.md` - Client requirements discussion
- `2026-03-22_system_architecture_review.md` - Technical design review

### Meeting Types

**Group Meetings** include:
- Sprint planning and standup meetings
- Architecture and design reviews
- Code review discussions
- Retrospectives and lessons learned
- Technical problem-solving sessions

**Client Meetings** include:
- Requirements gathering and refinement
- Demo and feedback sessions
- Acceptance testing meetings
- Change request discussions

## Using Templates

Copy the appropriate template from the `templates/` directory when creating a new meeting note:

```bash
cp docs/meetings/templates/group-meeting-template.md docs/meetings/group-meetings/YYYY-MM-DD_title.md
```

## Meeting Note Checklist

Each meeting note should include:
- [ ] Date and time of meeting
- [ ] Attendees present
- [ ] Agenda items discussed
- [ ] Key decisions made
- [ ] Action items with assigned owners and due dates
- [ ] Follow-ups or next meeting scheduled
- [ ] Links to relevant documentation or PRs

## Related Documentation

- See [../](../) for other project documentation
- See [../../README.md](../../README.md) for project overview
- See individual team member notes for detailed implementation decisions
