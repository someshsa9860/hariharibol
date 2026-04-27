# Cloud Rules

## Architecture Rules
- Follow Clean Architecture principles across all layers (presentation, domain, data).
- Separate concerns: UI, business logic, data access.
- Use dependency injection for testability.
- Implement proper error handling and logging.

## Coding Standards
- No hardcoding: all strings, colors, styles, endpoints managed in centralized config.
- Use localization for all user-facing text.
- Follow platform-specific guidelines (Material Design for Android, Human Interface Guidelines for iOS).
- Write testable code with unit and integration tests.

## Security Rules
- Never store sensitive data in plain text.
- Use secure storage for tokens and keys.
- Implement proper authentication and authorization.
- Validate all inputs and sanitize outputs.

## Performance Rules
- Optimize for offline usage where possible.
- Implement caching for frequently accessed data.
- Minimize network calls and bundle sizes.
- Use efficient data structures and algorithms.

## Deployment Rules
- Use CI/CD pipelines for automated testing and deployment.
- Maintain separate environments (dev, staging, prod).
- Monitor performance and errors in production.
- Implement rollback strategies for failed deployments.

## Collaboration Rules
- Use Git with proper branching strategy.
- Write clear commit messages and PR descriptions.
- Conduct code reviews for all changes.
- Document APIs and code changes.