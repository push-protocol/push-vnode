FROM node:16.20.2
WORKDIR /app
COPY . .
RUN yarn install
EXPOSE 4001
EXPOSE 4002
EXPOSE 4003
CMD ["yarn", "start"]