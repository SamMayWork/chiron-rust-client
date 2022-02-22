FROM node:17-alpine3.12
ENV NODE_ENV=production

WORKDIR /app

COPY . .

RUN apk --no-cache add curl

RUN curl -LO https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt)/bin/linux/amd64/kubectl
RUN chmod +x ./kubectl
RUN mv ./kubectl /usr/local/bin

RUN npm install --production

CMD [ "node", "index.js" ]