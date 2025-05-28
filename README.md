# Riddle Game - Real-time Multiplayer

A real-time multiplayer riddle game built with WebSockets, GraphQL, NestJS, and Next.js.

## Features

- Real-time riddle updates via WebSockets
- GraphQL API for data fetching
- Player synchronization to prevent duplicate answers
- Modern UI with Tailwind CSS

## Prerequisites

- Node.js (v20+)

## Project Structure

- `backend/` - NestJS application with GraphQL, WebSockets
- `frontend/` - Next.js application with Apollo Client and Socket.io


## Clone the repository

```bash
# Clone the dApp repository and contract repository
git clone --recurse-submodules https://github.com/Boyquotes/riddles-challenge.git
cd riddles-challenge/
```

## Setup and Installation

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# copy .env.example to .env
cp .env.example .env
# Update .env file with your variables for modes you want to use (local or testnet)

# Install dependencies
npm install

# Start the backend server in development mode
npm run start:dev
```

The backend server will run on http://localhost:3001 with GraphQL playground available at http://localhost:3001/graphql

Troubleshoot
If 3001 port was already in use, you can find the process who use it and kill it with:
```bash
nid=`lsof -i :3001 | grep LISTEN | awk '{print $2}'` && kill -9 $nid
```

### 2. Frontend Setup

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

- **Frontend**:
  - Next.js - React framework
  - Apollo Client - GraphQL client
  - Socket.io Client - WebSocket communication
  - Tailwind CSS - Styling

## Development

To run both frontend and backend concurrently, you can use the following commands:

```bash
# Optional : Terminal 1 - Deploy Contracts and launch local node or simply use contract on testnet
cd solidity-riddles
npm hardhat node

# After use only this script 
./start.sh

# OR independently
# Terminal 2 - Start Backend
cd backend
npm run start:dev

# Terminal 3 - Start Frontend
cd frontend
npm run dev
```

## Interact with smart contract

```bash
# Navigate to solidity-riddles directory
cd solidity-riddles

# Check last riddle status
npx hardhat run scripts/status.js --network localhost

# Set a new riddle unsolved
npx hardhat run scripts/setRiddle.js --network localhost

# Submit an answer, modify the answer variable in the script
npx hardhat run scripts/submit-answer.js --network localhost
```

