FROM node:14.15.4

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json yarn.lock ./

RUN yarn

# Bundle app source
COPY . .

COPY .env.production .env

# Run Typescript build
RUN yarn build

ENV NODE_ENV=production

EXPOSE 8080

CMD [ "node", "dist/index.js" ]

USER node