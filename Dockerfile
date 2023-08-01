FROM node:14-alpine

RUN apk add --update g++ make py3-pip git && rm -rf /var/cache/apk/*
USER root

WORKDIR /usr/src/app
RUN mkdir ./packages

RUN for app in core \lib-appbase \lib-utils; do mkdir "./packages/ove-$app"; done
COPY ./packages/ove-core/package.json ./packages/ove-core
COPY ./packages/ove-lib-appbase/package.json ./packages/ove-lib-appbase
COPY ./packages/ove-lib-utils/package.json ./packages/ove-lib-utils

RUN npm --global config set user root

RUN npm install -global pm2
RUN npm install -global lerna@4.0.0

COPY package.json lerna.json ./
RUN npm run install:prod

COPY . .

RUN npm uninstall -global lerna
RUN apk del git g++ make py3-pip

EXPOSE 8080

CMD [ "pm2-runtime", "pm2.json" ]

