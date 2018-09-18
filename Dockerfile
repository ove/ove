FROM node:carbon
WORKDIR /usr/src/app

# Bundle app source
COPY . .

# install dotnet
# (see https://www.microsoft.com/net/download/linux-package-manager/debian8/sdk-current)
RUN apt-get update && apt-get install -y curl apt-transport-https

RUN curl https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > microsoft.asc.gpg
RUN mv microsoft.asc.gpg /etc/apt/trusted.gpg.d/
RUN curl -o prod.list https://packages.microsoft.com/config/debian/8/prod.list
RUN mv prod.list /etc/apt/sources.list.d/microsoft-prod.list
RUN chown root:root /etc/apt/trusted.gpg.d/microsoft.asc.gpg
RUN chown root:root /etc/apt/sources.list.d/microsoft-prod.list


RUN export DOTNET_SKIP_FIRST_TIME_EXPERIENCE=true && apt-get update && apt-get install -y apt-transport-https dotnet-sdk-2.1

# install dependencies with npm
RUN npm install -global npx
RUN npm install -global pm2
RUN npm install -global lerna

# setup lerna
RUN lerna bootstrap --hoist

# build
RUN lerna run clean
RUN lerna run build

EXPOSE 8080-8090

CMD [ "pm2-runtime", "pm2.json" ]

