FROM node:10-stretch
WORKDIR /usr/src/app

# Bundle app source
COPY . .


RUN apt-get update && apt-get install apt-transport-https

# install dotnet
# (see https://www.microsoft.com/net/download/linux-package-manager/debian8/sdk-current)

RUN wget -qO- https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > microsoft.asc.gpg
RUN mv microsoft.asc.gpg /etc/apt/trusted.gpg.d/
RUN wget -q https://packages.microsoft.com/config/debian/9/prod.list
RUN mv prod.list /etc/apt/sources.list.d/microsoft-prod.list
RUN chown root:root /etc/apt/trusted.gpg.d/microsoft.asc.gpg
RUN chown root:root /etc/apt/sources.list.d/microsoft-prod.list


RUN export DOTNET_SKIP_FIRST_TIME_EXPERIENCE=true && apt-get update && apt-get install -y dotnet-sdk-2.1

# install libvips for tileservice
#https://github.com/phusion/baseimage-docker/issues/58
RUN echo 'debconf debconf/frontend select Noninteractive' | debconf-set-selections
RUN apt-get update && apt-get install -y libvips-dev


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

