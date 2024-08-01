#!/bin/bash
git pull
yarn install
yarn run build
cd build/src && mv * ../ && cd .. && cd .. 
cp .env build/.env
pm2 reload ecosystem.config.js --env production
# EOF