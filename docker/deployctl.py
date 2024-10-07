import os
import subprocess
import pty
from time import sleep

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

def main():
    # cmdi('docker build . -t vnode-main', '/Users/w/chain/push-vnode')
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

if __name__ == '__main__':
    try:
        main()
    except subprocess.CalledProcessError as e:
        print(f"\nAn error occurred while executing: {e.cmd}")
        print(f"Exit code: {e.returncode}")
