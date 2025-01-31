CHAIN_DIR="/Users/apasha/projects/push"
DOC_DIR="/Users/apasha/projects/push/push-vnode/docker"

    cd  ${DOC_DIR}
    set -o allexport 
    source ${DOC_DIR}/.env 
    source ${DOC_DIR}/common.env 
    source ${DOC_DIR}/v-specific.env 
    set +o allexport 

    export CONFIG_DIR=${DOC_DIR}/v2
    export LOG_DIR=${CONFIG_DIR}/log
    export ABI_DIR=${DOC_DIR}/_abi
    export ETH_KEY_PATH=${CONFIG_DIR}/node_key.json
    export LOCALH=true 
    export VALIDATOR_PING_SCHEDULE="* */30 * * * *"
    
    export PG_HOST=localhost
    export PG_PORT=${EXTERNAL_PG_PORT}
    export DB_NAME=vnode2
    export PORT=4002 
    export REDIS_URL=redis://localhost:${EXTERNAL_REDIS_PORT}
    export VALIDATOR_RPC_ENDPOINT=http://localhost:8545
    
    echo  > ${LOG_DIR}/debug.log
    echo  > ${LOG_DIR}/error.log
    cd ${DOC_DIR}/..
    yarn dev
   