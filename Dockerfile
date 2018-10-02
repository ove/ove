FROM node:10-stretch
WORKDIR /usr/src/app

# Bundle app source
COPY . .

# install dependencies with npm
RUN npm install -global npx
RUN npm install -global pm2
RUN npm install -global lerna

# setup lerna
RUN lerna bootstrap --hoist

# build
RUN lerna run clean
RUN lerna run build

EXPOSE 8080

CMD [ "pm2-runtime", "pm2.json" ]

