#!/bin/bash
DNSMASQ_CONF="/etc/dnsmasq.conf"
echo "" > $DNSMASQ_CONF
docker ps --format '{{.Names}} {{.Networks}}' | while read line; do
    CONTAINER_NAME=$(echo $line | awk '{print $1}')
    NETWORK_NAME=$(echo $line | awk '{print $2}')
    IP_ADDRESS=$(docker inspect -f "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}" $CONTAINER_NAME)
    if [ ! -z "$IP_ADDRESS" ]; then
        echo "address=/${CONTAINER_NAME}.${NETWORK_NAME}/$IP_ADDRESS" >> $DNSMASQ_CONF
    fi
done