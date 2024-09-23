#!/bin/bash
read -p "Add CONTAINER.localh into /etc/hosts for every running container? (y/n): " choice
case "$choice" in
  y|Y ) echo "Proceeding ...";;
  * ) echo "Aborted."; exit 1;;
esac
echo "sudo for editing /etc/hosts"
sudo python3 update-hosts.py
echo "showing /etc/hosts"
cat /etc/hosts | grep ".localh"