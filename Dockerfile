FROM node:20.6.1
WORKDIR /app
COPY . .
RUN yarn install
EXPOSE 4001
EXPOSE 4002
EXPOSE 4003
CMD ["yarn", "start"]