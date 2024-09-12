# for every docker container from "push-shared-network"
# adds a row
# 127.0.0.1 container.local
# to /etc/hosts

# precondition: start all docker containers
# RUN: sudo python3 update-hosts.py




import subprocess
import os
import re


# Function to check if the script is running as root
def check_root():
    if os.geteuid() != 0:
        print("This script must be run as root. Try again with sudo.")
        exit(1)

# Function to read docker ps output
def get_docker_containers():
    result = subprocess.run(["docker", "ps", "--format", "{{.Names}} {{.Networks}}"], stdout=subprocess.PIPE)
    return result.stdout.decode('utf-8').strip().split('\n')

# Function to backup /etc/hosts file
def backup_hosts_file():
    subprocess.run(["cp", "/etc/hosts", "/etc/hosts.bak"])

# Function to check if the host entry already exists
def host_entry_exists(hostname):
    with open("/etc/hosts", "r") as file:
        content = file.read()
        return re.search(rf"127\.0\.0\.1\s+{re.escape(hostname)}\.localh", content)

# Function to append a new host entry to /etc/hosts
def append_to_hosts(hostname):
    with open("/etc/hosts", "a") as file:
        file.write(f"127.0.0.1 {hostname}.localh\n")

# Main function
def update_hosts():
    # Check if script is run as root
    check_root()

    # Backup the existing /etc/hosts file
    backup_hosts_file()

    # Get docker container names and networks
    docker_output = get_docker_containers()

    for line in docker_output:
        if line:
            name, network = line.split()

            # Only process containers in push-shared-network
            if network == "push-shared-network":
                # Check if the host entry already exists
                if not host_entry_exists(name):
                    print(f"Adding 127.0.0.1 {name}.localh to /etc/hosts")
                    append_to_hosts(name)
                else:
                    print(f"{name}.local already exists in /etc/hosts, skipping.")

    print("Script completed.")

if __name__ == "__main__":
    update_hosts()
