#!/bin/bash

# stops everything
# deletes logs and database directory state

read -p "Are you sure you want to stop containers and clear data? (y/n): " choice
case "$choice" in 
  y|Y ) echo "Proceeding with cleanup...";;
  * ) echo "Cleanup aborted."; exit 1;;
esac

echo "starting cleanup"

echo "removing s nodes"
docker compose -f s.yml down


echo "removing v nodes"
docker compose -f v.yml down

echo "removing a nodes"
docker compose -f a.yml down


echo "removing evm"
docker compose -f evm.yml down

echo "removing db nodes"
docker compose -f db.yml down


echo "removing logs"
for i in {1..10}; do
    rm -rf "v${i}/log/*"
    rm -rf "s${i}/log/*"
    rm -rf "a${i}/log/*"
done
sleep 3

echo "removing db state"
rm -rf external

echo "cleanup done"