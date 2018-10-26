FROM node:10-alpine
WORKDIR /usr/src/app

COPY . .

RUN npm install -global pm2
RUN npm install -global lerna

RUN npm run install:prod 

RUN npm uninstall -global lerna

EXPOSE 8080

CMD [ "pm2-runtime", "pm2.json" ]

