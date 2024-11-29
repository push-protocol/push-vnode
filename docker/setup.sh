DOCKER_DIR=$(pwd)
cd "$DOCKER_DIR/../.." || exit 1
CHAIN_DIR=$(pwd)

echo "DOCKER_DIR is ${CHAIN_DIR}"
echo "CHAIN_DIR is ${CHAIN_DIR}"

echo -n
echo "STARTING DB"
echo "-> Running DB and showing logs; Press ENTER."
read -p "(Ctrl+C in ~30sec to stop reading logs) "
echo -n
cd "${DOCKER_DIR}" || exit 1
docker compose -f db.yml down && docker compose -f db.yml up -d && docker compose -f db.yml logs -f

echo -n
echo "---- STARTING EVM"
echo "-> Running EVM and showing logs; Press ENTER."
read -p "(Ctrl+C in ~60sec to stop reading logs) "
echo -n
cd "${CHAIN_DIR}/push-node-smart-contracts" || exit 1
docker build . -t hardhat-main
cd "${DOCKER_DIR}" || exit 1
docker compose -f evm.yml down && docker compose -f evm.yml up -d && docker compose -f evm.yml logs -f



echo -n
echo "---- STARTING VNODE"
echo "-> Running and showing logs; Press ENTER."
read -p "(Ctrl+C in ~60sec to stop reading logs) "
echo -n
cd "${CHAIN_DIR}/push-vnode" || exit 1
docker build . -t vnode-main
cd "${DOCKER_DIR}" || exit 1
docker compose -f v.yml down && docker compose -f v.yml up -d && docker compose -f v.yml logs -f

echo -n
echo "---- STARTING SNODE"
echo "-> Running and showing logs; Press ENTER."
read -p "(Ctrl+C in ~60sec to stop reading logs) "
echo -n
cd "${CHAIN_DIR}/push-snode" || exit 1
docker build . -t snode-main
cd "${DOCKER_DIR}" || exit 1
docker compose -f s.yml down && docker compose -f s.yml up -d && docker compose -f s.yml logs -f


echo -n
echo "---- STARTING ANODE"
echo "-> Running and showing logs; Press ENTER."
read -p "(Ctrl+C in ~60sec to stop reading logs) "
echo -n
cd "${CHAIN_DIR}/push-anode" || exit 1
docker build -t anode-main -f Dockerfile.light .
cd "${DOCKER_DIR}" || exit 1
docker compose -f a.yml down && docker compose -f a.yml up -d && docker compose -f a.yml logs -f




echo "SUCCESS"