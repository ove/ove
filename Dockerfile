FROM node:14-alpine
WORKDIR /usr/src/app

ARG PORT=8080

RUN npm install -global pm2
RUN npm install -global lerna

COPY . .
RUN npm run install:prod

RUN npm uninstall -global lerna

EXPOSE ${PORT}

ENTRYPOINT [ "pm2-runtime" ]
CMD [ "pm2.json" ]

