#!/bin/bash

# stops everything
# deletes logs and database directory state

read -p "Are you sure you want to stop containers and clear data? (y/n): " choice
case "$choice" in 
  y|Y ) echo "Proceeding with cleanup...";;
  * ) echo "Cleanup aborted."; exit 1;;
esac

echo "starting cleanup"

echo "stopping s nodes"
docker-compose -f s.yml down
sleep 10

echo "stopping v nodes"
docker-compose -f v.yml down
sleep 10

echo "stopping db nodes"
docker-compose -f db.yml down
sleep 10

echo "removing logs"
for i in {1..10}; do
    rm -f "v${i}/log/error.log" "v${i}/log/debug.log"
    rm -f "s${i}/log/error.log" "s${i}/log/debug.log"
done
sleep 10

echo "removing db state"
rm -rf external

echo "cleanup done"