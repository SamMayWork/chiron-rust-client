FROM node:17-alpine3.12
ENV NODE_ENV=production

WORKDIR /app

COPY . .

RUN apk --no-cache add curl

# Rust Specifics for evaluation
RUN apk add build-base
RUN curl https://sh.rustup.rs -sSf | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

RUN npm install --production

CMD [ "node", "index.js" ]