#!/bin/bash

# One-Click Deployment Script for Vellko Affiliate Signup

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}Starting Deployment...${NC}"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed.${NC}"
    echo "Please install Docker and Docker Compose first."
    exit 1
fi

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${RED}Error: .env file not found.${NC}"
    echo "Please ensure you have created the .env file with your configuration."
    exit 1
fi

echo "Stopping existing containers..."
docker compose -f docker-compose.prod.yml down

echo "Building and Starting containers..."
docker compose -f docker-compose.prod.yml up -d --build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Deployment Successful!${NC}"
    echo "Frontend is running on port found in .env (default 3001)"
    echo "Backend is running on port found in .env (default 8001)"
    echo -e "${GREEN}You can verify by running: docker compose -f docker-compose.prod.yml ps${NC}"
else
    echo -e "${RED}Deployment Failed.${NC}"
    exit 1
fi
