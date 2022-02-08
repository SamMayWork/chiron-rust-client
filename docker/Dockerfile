FROM node:17-alpine3.12
ENV NODE_ENV=production

WORKDIR /app

COPY . .

RUN npm install --production

CMD [ "node", "index.js" ]