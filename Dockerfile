# Base image
FROM node:18

# Create app directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy everything else
COPY . .

# Build frontend (assuming Vite)
RUN npm run build

# Expose backend port
EXPOSE 5050

# Start server
CMD ["node", "src/backend/server.js"]
