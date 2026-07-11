FROM node:20-slim

WORKDIR /app

COPY package*.json ./
COPY patches ./patches

RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production

EXPOSE 8080

CMD ["node", "app.js"]
