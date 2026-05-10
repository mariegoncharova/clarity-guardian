# Testing Checklist

## Preparation

- [ ] Read the task description and acceptance criteria.
- [ ] Confirm the environment, test data, feature flags, and user roles.
- [ ] Check whether there are dependencies on backend, frontend, analytics, or external services.

## Functional Checks

- [ ] Verify the main happy path.
- [ ] Verify each acceptance criterion separately.
- [ ] Verify validation and error states.
- [ ] Verify empty, boundary, and unusual input values.
- [ ] Verify permissions and role-based access, if applicable.

## Regression Checks

- [ ] Check nearby flows that use the same component, API, or business rule.
- [ ] Check that existing data is not broken.
- [ ] Check that previous behavior is preserved where the task does not require changes.

## Technical Checks

- [ ] Check API responses, status codes, and error payloads, if applicable.
- [ ] Check logs and monitoring signals, if applicable.
- [ ] Check analytics events, if applicable.

## Questions Before Testing

- [ ] Are there missing requirements, unclear edge cases, or contradictory acceptance criteria?
