# Stage 1: Build the application
FROM golang:1.22-alpine AS builder
WORKDIR /app

# Copy go.mod and go.sum files
COPY go.mod go.sum ./
# Download dependencies
RUN go mod download

# Copy the source code
COPY . .

# Build the application
# -ldflags="-w -s" strips debug information to reduce binary size
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o monitor ./cmd/monitor

# Stage 2: Create the final, minimal image
FROM alpine:latest
WORKDIR /app

# Copy the binary from the builder stage
COPY --from=builder /app/monitor .
# Copy any necessary config files
COPY configs/config.yaml ./configs/config.yaml

# Expose the port the API server runs on
EXPOSE 8080

# Run the application
CMD ["./monitor"]
