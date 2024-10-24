import os
import subprocess
import pty
from time import sleep
import sys

# FRAMEWORK ------------------------------------------------------------------------------------------------------------

def cmdi(command, cwd=None):
    argv = ["sh", "-c", command]
    original_cwd = os.getcwd()
    try:
        if cwd:
            os.chdir(cwd)
            print(f"\nRunning: {command} in {cwd}")
        else:
            print(f"\nRunning: {command} in {original_cwd}")
        # Spawn a new process within a pseudo-terminal
        exit_status = pty.spawn(argv)

        # Convert the exit status to an exit code
        return_code = os.waitstatus_to_exitcode(exit_status)
        if return_code != 0:
            raise subprocess.CalledProcessError(return_code, command)
    finally:
        os.chdir(original_cwd)

def cmd(command, cwd=None):
    process = subprocess.Popen(
        command, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, cwd=cwd, universal_newlines=True
    )
    for line in process.stdout:
        print(line, end='')
    process.wait()
    if process.returncode != 0:
        raise subprocess.CalledProcessError(process.returncode, command)

# COMMANDS WITH PARAMS -------------------------------------------------------------------------------------------------

def deployValidator():
    # cmdi('docker build . -t vnode-main', '/Users/w/chain/push-vnode')
    print("deploying vnode code on DEV environment")
    dir_vnode = '/home/chain/source/push-vnode'
    dir_yml = '/home/chain'

    # cmdi('ls -la')
    # exit(0) # todo remove

    cmdi('git config credential.helper store', dir_vnode)
    cmdi('git pull', dir_vnode)
    sleep(10)

    cmdi('docker build . -t vnode-main', dir_vnode)
    sleep(10)
    cmdi('docker compose -f v.yml down', dir_yml)
    sleep(10)
    cmdi('docker compose -f v.yml up -d', dir_yml)
    sleep(10)

    print("Displaying the last 200 lines of Docker Compose logs...")
    cmdi('docker compose -f v.yml logs | tail -n 200', dir_yml)

def deployStorage():
    print("deploying snode code on DEV environment")
    # cmdi('docker build . -t vnode-main', '/Users/w/chain/push-vnode')
    dir_snode = '/home/chain/source/push-snode'
    dir_yml = '/home/chain'

    # cmdi('ls -la')
    # exit(0) # todo remove

    cmdi('git config credential.helper store', dir_snode)
    cmdi('git pull', dir_snode)
    sleep(10)

    cmdi('docker build . -t snode-main', dir_snode)
    sleep(10)
    cmdi('docker compose -f s.yml down', dir_yml)
    sleep(10)
    cmdi('docker compose -f s.yml up -d', dir_yml)
    sleep(10)

    print("Displaying the last 200 lines of Docker Compose logs...")
    cmdi('docker compose -f s.yml logs | tail -n 200', dir_yml)

def test(msg1, msg2):
    print(msg1, msg2)


# FRAMEWORK ------------------------------------------------------------------------------------------------------------

def main():
    if len(sys.argv) < 2:
        print("Usage: script.py cmd [cmdParams...]")
        sys.exit(1)
    cmd = sys.argv[1]
    cmdParams = sys.argv[2:]

    # Map cmd to function
    # ADD COMMANDS HERE !!!!!
    commands = {
        'deployValidator': deployValidator,
        'deployStorage': deployStorage,
        'test': test
    }

    if cmd in commands:
        func = commands[cmd]
        try:
            func(*cmdParams)
        except TypeError as e:
            print(f"Error: {e}")
            print(f"The command '{cmd}' requires {func.__code__.co_argcount} parameters.")
    else:
        print(f"Unknown command: {cmd}")
        print("Available commands: " + ", ".join(commands.keys()))
        sys.exit(1)

if __name__ == '__main__':
    try:
        main()
    except subprocess.CalledProcessError as e:
        print(f"\nAn error occurred while executing: {e.cmd}")
        print(f"Exit code: {e.returncode}")

