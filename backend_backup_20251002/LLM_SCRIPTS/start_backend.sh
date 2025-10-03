#!/bin/bash

echo "Stopping and removing existing Docker containers..."
docker compose down --remove-orphans

echo "Starting Docker containers..."
docker compose up -d

echo "Docker containers started."
