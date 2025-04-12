# BDTV - M3U Streaming Platform

A Next.js application for managing and viewing M3U playlists with authentication, channel browsing, and favorites management.

## Project Status

### Completed Stages (1-6)

#### 1. Initial Project Setup
- Created the main project directory structure
- Set up Next.js project using App Router, TypeScript, and Tailwind CSS
- Initialized Git repository
- Created root .gitignore file

#### 2. Docker & Database Setup
- Created docker-compose.yml file with PostgreSQL service
- Set up persistent database volume
- Created .env file for secrets and database configuration
- Defined Docker network and app service

#### 3. Drizzle ORM & Database Connection
- Installed and configured Drizzle ORM with PostgreSQL
- Created database schema for users table
- Set up database client connection
- Generated and applied initial SQL migrations

#### 4. Next.js Dockerfile & Service
- Created development Dockerfile for the Next.js application
- Added volume mounts for live code reloading
- Successfully verified container builds

#### 5. Authentication Setup (NextAuth.js)
- Installed and configured NextAuth.js with credentials provider
- Created API routes for authentication
- Implemented login and registration pages
- Set up middleware for route protection
- Created authentication-related components

#### 6. Core Feature Backend
- Updated database schema for playlists, channels, favorites, and chat
- Created M3U parser utility
- Implemented file storage utility for uploads
- Created API routes for playlist management
- Implemented channel browsing with filtering and search
- Added favorites management API
- Successfully generated and applied database migrations

### Remaining Stages (7-11)

#### 7. Core Feature Frontend
- Implement UI components for M3U playlist upload
- Create channel browsing interface with search/filter
- Integrate video player (react-player)
- Build favorites management UI
- Implement theme toggle using React Context

#### 8. Real-time Chat
- Set up Socket.IO server integration
- Create chat UI components
- Implement real-time message exchange

#### 9. Dockerfile Optimization
- Refine Dockerfile with multi-stage build
- Optimize for production deployment
- Add Nginx as a reverse proxy (optional)

#### 10. CI/CD Setup
- Create GitHub Actions workflow
- Set up automated deployment
- Configure server-side deployment script

#### 11. Documentation
- Complete comprehensive documentation
- Add setup and usage instructions
- Document API endpoints

## Technology Stack

- **Frontend**: Next.js 14+ (App Router), React, Tailwind CSS
- **Video Player**: react-player with HLS support
- **Backend**: Next.js API Routes
- **Authentication**: NextAuth.js with username/password
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Real-time**: Socket.IO (planned)
- **State Management**: React Context API
- **Containerization**: Docker & Docker Compose
- **CI/CD**: GitHub Actions (planned)

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose
- Git

### Environment Setup

Create a `.env` file in the project root with the following variables:

```
# PostgreSQL Credentials
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=bdtv

# Database URL for local tools
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bdtv

# NextAuth Secret 
# Generate with: openssl rand -base64 32
NEXTAUTH_SECRET=your_generated_secret_here

# Project name for containers
PROJECT_NAME=bdtv
```

### Running the Application

1. Start the containers:
   ```
   docker-compose up -d
   ```

2. Access the application at http://localhost:3000

### Database Management

- Generate migrations: `npm run db:generate`
- Apply migrations: `npm run db:push`
- Explore database: `npm run db:studio`

## Project Structure

```
bd-tv/
├── app/                    # Next.js application
│   ├── src/
│   │   ├── app/            # Next.js App Router
│   │   │   ├── components/     # React components
│   │   │   ├── db/             # Database schema and client
│   │   │   ├── utils/          # Utility functions
│   │   │   └── types/          # TypeScript type definitions
│   │   └── Dockerfile          # Next.js container setup
│   ├── drizzle/                # Database migrations
│   └── docker-compose.yml      # Container orchestration
├── drizzle.config.ts       # Drizzle ORM configuration
└── .env                    # Environment variables
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. 