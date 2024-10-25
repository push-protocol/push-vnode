import os
import subprocess
import pty
from time import sleep
import sys


# FRAMEWORK ------------------------------------------------------------------------------------------------------------

commands_list = {}

# Decorator to register command functions
def command(func):
    commands_list[func.__name__] = func
    return func

# Runs interactive shell with colors
def sh(command, cwd=None):
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

# Runs non-interactive shell; no colors
def cmdni(command, cwd):
    process = subprocess.Popen(
        command, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, cwd=cwd, universal_newlines=True
    )
    for line in process.stdout:
        print(line, end='')
    process.wait()
    if process.returncode != 0:
        raise subprocess.CalledProcessError(process.returncode, command)



def main():
    if len(sys.argv) < 2:
        print("Usage: deployctl.py cmd [cmdParams...]")
        print("Available commands: " + ", ".join(commands_list.keys()))
        sys.exit(1)
    cmd_name = sys.argv[1]
    cmd_params = sys.argv[2:]

    if cmd_name in commands_list:
        func = commands_list[cmd_name]
        try:
            func(*cmd_params)
        except TypeError as e:
            print(f"Error: {e}")
            print(f"The command '{cmd_name}' requires {func.__code__.co_argcount} parameters.")
    else:
        print(f"Unknown command: {cmd_name}")
        print("Available commands: " + ", ".join(commands_list.keys()))
        sys.exit(1)



# COMMANDS WITH PARAMS -------------------------------------------------------------------------------------------------

@command
def deployValidator():
    # cmdi('docker build . -t vnode-main', '/Users/w/chain/push-vnode')
    print("deploying vnode code on DEV environment")
    dir_vnode = '/home/chain/source/push-vnode'
    dir_yml = '/home/chain'

    # cmdi('ls -la')
    # exit(0) #

    sh('git config credential.helper store', dir_vnode)
    sh('git fetch', dir_vnode)
    sh('git switch main', dir_vnode)
    sh('git pull', dir_vnode)
    sh('git status', dir_vnode)
    sleep(10)

    sh('docker build . -t vnode-main', dir_vnode)
    sleep(10)
    sh('docker compose -f v.yml down', dir_yml)
    sleep(10)
    sh('docker compose -f v.yml up -d', dir_yml)
    sleep(10)

    print("Displaying the last 200 lines of Docker Compose logs...")
    sh('docker compose -f v.yml logs | tail -n 200', dir_yml)

@command
def deployStorage():
    print("deploying snode code on DEV environment")
    # cmdi('docker build . -t vnode-main', '/Users/w/chain/push-vnode')
    dir_snode = '/home/chain/source/push-snode'
    dir_yml = '/home/chain'

    sh('git config credential.helper store', dir_snode)
    sh('git fetch', dir_snode)
    sh('git switch main', dir_snode)
    sh('git pull', dir_snode)
    sh('git status', dir_snode)
    sleep(10)

    sh('docker build . -t snode-main', dir_snode)
    sleep(10)
    sh('docker compose -f s.yml down', dir_yml)
    sleep(10)
    sh('docker compose -f s.yml up -d', dir_yml)
    sleep(10)

    print("Displaying the last 200 lines of Docker Compose logs...")
    sh('docker compose -f s.yml logs | tail -n 200', dir_yml)

@command
def test(msg1, msg2):
    print(msg1, msg2)


if __name__ == '__main__':
    try:
        main()
    except subprocess.CalledProcessError as e:
        print(f"\nAn error occurred while executing: {e.cmd}")
        print(f"Exit code: {e.returncode}")
