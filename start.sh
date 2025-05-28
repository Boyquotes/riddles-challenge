#!/bin/bash

# Start Backend
echo "Starting backend server..."
cd backend
npm run start:dev &
BACKEND_PID=$!
echo "Started backend server with PID: $BACKEND_PID"

# Wait a moment for the backend to initialize
sleep 3

# Start Frontend
echo "Starting frontend server..."
cd ../frontend
npm run dev &
FRONTEND_PID=$!
echo "Started frontend server with PID: $FRONTEND_PID"

echo "Both servers are running!"
echo "Backend: http://localhost:3001"
echo "Frontend: http://localhost:3000"
echo "GraphQL Playground: http://localhost:3001/graphql"

# Handle Ctrl+C to gracefully shut down all processes
trap "kill $BACKEND_PID $FRONTEND_PID; echo 'Shutting down servers...'; exit" INT

# Keep the script running
wait
