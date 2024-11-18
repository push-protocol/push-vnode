#!/bin/bash

# for every docker container from "push-dev-network"
# adds a row
# 127.0.0.1 container.local
# to /etc/hosts

# Check if running as root
if [ "$(id -u)" != "0" ]; then
   echo "This script must be run as root. Try again with sudo."
   exit 1
fi

# Run docker command to get the list of names and networks
docker_output=$(docker ps --format '{{.Names}} {{.Networks}}')

# Backup the existing /etc/hosts file
cp /etc/hosts /etc/hosts.bak

# Process each line from docker output
while read -r line; do
  name=$(echo "$line" | awk '{print $1}') # Extract the container name
  network=$(echo "$line" | awk '{print $2}') # Extract the network name

  # Only add lines for containers in push-dev-network
  if [[ "$network" == "push-dev-network" ]]; then
    # Check if /etc/hosts already contains the 127.0.0.1 mapping for this name
    if ! grep -q "127.0.0.1 $name.local" /etc/hosts; then
      echo "Adding 127.0.0.1 $name.local to /etc/hosts"
      echo "127.0.0.1 $name.local" >> /etc/hosts
    else
      echo "$name.local already exists in /etc/hosts, skipping."
    fi
  fi
done <<< "$docker_output"

echo "Script completed."