FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

COPY tmp /app/tmp

RUN npm run build

# Expose ports for Next.js and Peerflix
EXPOSE 80
EXPOSE 8888-8898

CMD ["npm", "start"]
