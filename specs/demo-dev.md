# Real-time Collaborative Task Manager

## Problem

Build a simple but functional real-time collaborative task management web application that multiple users can use simultaneously. Think of it as a minimal Trello/Todoist where changes sync instantly across all connected clients.

## Constraints

- Must be a single deployable artifact (no microservices, no separate frontend/backend repos)
- Must include real-time sync between users (WebSocket or SSE — changes appear instantly in other tabs/browsers)
- Must work offline with sync-on-reconnect (optimistic updates, conflict resolution)
- Use only open-source dependencies
- No external database service required — embedded/file-based DB is fine (SQLite, LevelDB, etc.)
- Must run with a single command (e.g., `npm start` or `go run .`)

## Desired Outputs

- Working web application with backend and frontend in a single project
- README.md with clear setup instructions (`git clone` → `npm install` → `npm start`)
- At least 5 meaningful tests (not trivial — test actual business logic like sync, conflict resolution)
- Clean project structure following the chosen stack's conventions

## Success Criteria

- Users can create, edit, delete, and complete tasks
- Tasks can be organized into lists/categories
- Changes sync in real-time across multiple browser tabs (demonstrate by opening 2+ tabs)
- App continues to work offline and syncs when reconnected
- App builds and runs successfully with a single command
- All tests pass
- Code is clean, well-structured, and follows the chosen stack's best practices

## Additional Context

This is a hackathon demo — the app doesn't need user authentication, deployment configs, or production-grade error handling. Focus on the core real-time sync experience being smooth and impressive. The "wow factor" is opening two browser windows and seeing changes appear instantly in both.
