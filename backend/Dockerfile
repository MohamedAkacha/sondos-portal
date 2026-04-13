FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache curl
COPY --from=builder /app .
EXPOSE 5000
USER node
CMD ["node", "server.js"]
