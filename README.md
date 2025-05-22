# Riddle Game - Real-time Multiplayer

A real-time multiplayer riddle game built with WebSockets, GraphQL, Redis, NestJS, and Next.js.

## Features

- Real-time riddle updates via WebSockets
- GraphQL API for data fetching
- Redis for storing riddles and game state
- Player synchronization to prevent duplicate answers
- Modern UI with Tailwind CSS

## Prerequisites

- Node.js (v16+)
- Redis server running on localhost:6379

## Project Structure

- `backend/` - NestJS application with GraphQL, WebSockets, and Redis
- `frontend/` - Next.js application with Apollo Client and Socket.io

## Setup and Installation

### 1. Start Redis Server

Make sure you have Redis installed and running on your machine:

```bash
# Start Redis server
redis-server
```

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Start the backend server in development mode
npm run start:dev
```

The backend server will run on http://localhost:3001 with GraphQL playground available at http://localhost:3001/graphql

### 3. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start the frontend development server
npm run dev
```

The frontend application will be available at http://localhost:3000

## How to Play

1. Open the application in your browser
2. You'll see a riddle displayed on the screen
3. Type your answer in the input field and submit
4. If your answer is correct, a new riddle will be shown to all players
5. The game continues as players solve riddles

## Game Rules

- Each player can submit multiple answers for a riddle
- When a player submits the correct answer, all players receive a new riddle
- Players are synchronized in real-time to avoid duplicate answers

## Technologies Used

- **Backend**:
  - NestJS - Node.js framework
  - GraphQL - API query language
  - WebSockets - Real-time communication
  - Redis - Data storage and game state management

- **Frontend**:
  - Next.js - React framework
  - Apollo Client - GraphQL client
  - Socket.io Client - WebSocket communication
  - Tailwind CSS - Styling

## Development

To run both frontend and backend concurrently, you can use the following commands:

```bash
# Terminal 1 - Start Redis
redis-server

# Terminal 2 - Start Backend
cd backend
npm run start:dev

# Terminal 3 - Start Frontend
cd frontend
npm run dev
```
