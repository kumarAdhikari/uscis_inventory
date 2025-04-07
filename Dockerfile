# ---------- Build React frontend ----------
FROM node:18-alpine as frontend

WORKDIR /app

COPY . .

# Build only the frontend
RUN cd src && npm install && npm run build

# ---------- Backend server ----------
FROM node:18-alpine as backend

WORKDIR /app

# Copy everything including the built frontend
COPY . .

# Install backend deps
RUN cd src/backend && npm install

# Expose port (adjust if needed)
EXPOSE 5050

# Start the backend server (which also serves the frontend)
CMD ["node", "src/backend/server.js"]
