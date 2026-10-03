FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --frozen-lockfile --production=false

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
