FROM node:17

# Install dependencies
RUN apt-get update
RUN apt-get install -y build-essential libxi-dev libglu1-mesa-dev libglew-dev pkg-config
# Set working directory
WORKDIR /var/www/app

COPY package*.json ./

EXPOSE 5000


CMD npm install; npm run start:dev
