FROM node:20.6.1
WORKDIR /app
COPY . .
RUN yarn install
# size reduction: "--production" removes dev deps; "cache clean" reduces cache
#RUN yarn install --production && yarn cache clean
EXPOSE 4001
EXPOSE 4002
EXPOSE 4003
CMD ["yarn", "start"]