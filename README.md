# REINA Pabili Services

A full-stack community delivery platform developed as an Information Technology capstone project. It connects customers, restaurants, riders, and administrators through an ordering and delivery workflow.

## Features

- Customer ordering, cart, profile, and delivery tracking
- Restaurant profile, menu, and order management
- Rider delivery tools and location-related features
- Administrative management of users, restaurants, riders, orders, payments, and feedback
- Authentication, password recovery, notifications, and messaging
- Map and location integrations

Some features require external services and appropriate configuration.

## Technology Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS
- Backend: Node.js, Express
- Database: PostgreSQL, Drizzle ORM
- Authentication: Passport and PostgreSQL-backed sessions
- Integrations: Google Maps, email delivery, and payment processing

## Requirements

- Node.js and npm
- PostgreSQL
- Credentials for any external services you intend to enable

## Local Setup

1. Clone this repository.
2. Install dependencies using `npm install`.
3. Configure the required environment variables in a local environment file.
4. Configure a development database and review the schema and migrations.
5. Start the development server using `npm run dev`.

## Available Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Build the frontend and server |
| `npm start` | Start the production build |
| `npm run check` | Run TypeScript checks |
| `npm run db:push` | Push schema changes to the configured database |

## Environment Variables

The application references environment variables for database access, session security, email, Google Maps, and object storage. The exact requirements depend on the enabled services and deployment environment.

Use your hosting provider’s secret settings for production credentials. Never publish database URLs, passwords, API keys, session secrets, or personal payment QR codes.

## Security and Demo Data

Use a separate development or demo database. Do not connect a public portfolio demo to a database containing real customer or business information. Review migrations and one-off SQL scripts before executing them.

## Project Status

Prepared as a portfolio project. Deployment and third-party integrations may require additional configuration before the application can be used in another environment.

## License

A license has not yet been specified. Confirm the intended license before permitting reuse or redistribution.
