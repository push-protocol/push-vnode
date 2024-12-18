DOCKER_DIR=$(pwd)
cd "${DOCKER_DIR}/../.." || exit 1
CHAIN_DIR="${DOCKER_DIR}/../.."

echo "DOCKER_DIR is ${DOCKER_DIR}"
echo "CHAIN_DIR is ${CHAIN_DIR}"

cd "${CHAIN_DIR}/push-node-smart-contracts" || exit 1
cd "${CHAIN_DIR}/push-vnode" || exit 1
cd "${CHAIN_DIR}/push-snode" || exit 1
cd "${CHAIN_DIR}/push-anode" || exit 1

cp -n "${CHAIN_DIR}/push-node-smart-contracts/.env.example" "${CHAIN_DIR}/push-node-smart-contracts/.env"

echo "Each container shows logs after startup. Hit Ctrl-C to stop reading logs!"

echo "creating docker network (if needed)"
docker network create push-dev-network

cd "${DOCKER_DIR}" || exit 1
echo
echo "---- STARTING DB"
read -p "-> Press ENTER to continue, or 'n' to skip: " response
if [[ "$response" == "n" || "$response" == "N" ]]; then
    echo "Skipped"
else
  echo
  cd "${DOCKER_DIR}" || exit 1
  docker compose -f db.yml down && docker compose -f db.yml up -d && docker compose -f db.yml logs -f
fi

echo
echo "---- STARTING EVM"
read -p "-> Press ENTER to continue, or 'n' to skip: " response
if [[ "$response" == "n" || "$response" == "N" ]]; then
    echo "Skipped"
else
  echo
  cd "${CHAIN_DIR}/push-node-smart-contracts" || exit 1
  docker build . -t hardhat-main
  cd "${DOCKER_DIR}" || exit 1
  docker compose -f evm.yml down && docker compose -f evm.yml up -d && docker compose -f evm.yml logs -f
fi


echo
echo "---- STARTING VNODE"
read -p "-> Press ENTER to continue, or 'n' to skip: " response
if [[ "$response" == "n" || "$response" == "N" ]]; then
  echo "Skipped"
else
  echo
  cd "${CHAIN_DIR}/push-vnode" || exit 1
  docker build . -t vnode-main
  cd "${DOCKER_DIR}" || exit 1
  docker compose -f v.yml down && docker compose -f v.yml up -d && docker compose -f v.yml logs -f
fi

echo
echo "---- STARTING SNODE"
read -p "-> Press ENTER to continue, or 'n' to skip: " response
if [[ "$response" == "n" || "$response" == "N" ]]; then
  echo "Skipped"
else
  echo
  cd "${CHAIN_DIR}/push-snode" || exit 1
  docker build . -t snode-main
  cd "${DOCKER_DIR}" || exit 1
  docker compose -f s.yml down && docker compose -f s.yml up -d && docker compose -f s.yml logs -f
fi

echo
echo "---- STARTING ANODE"
read -p "-> Press ENTER to continue, or 'n' to skip: " response
if [[ "$response" == "n" || "$response" == "N" ]]; then
  echo "Skipped"
else
  echo
  cd "${CHAIN_DIR}/push-anode" || exit 1
  docker build -t anode-main -f Dockerfile.light .
  cd "${DOCKER_DIR}" || exit 1
  docker compose -f a.yml down && docker compose -f a.yml up -d && docker compose -f a.yml logs -f
fi



echo "SUCCESS"