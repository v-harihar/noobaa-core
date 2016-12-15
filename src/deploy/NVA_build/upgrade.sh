#!/bin/bash

. /root/node_modules/noobaa-core/src/deploy/NVA_build/deploy_base.sh
. /root/node_modules/noobaa-core/src/deploy/NVA_build/common_funcs.sh

PACKAGE_FILE_NAME="new_version.tar.gz"
WRAPPER_FILE_NAME="upgrade_wrapper.sh"
WRAPPER_FILE_PATH="/tmp/test/noobaa-core/src/deploy/NVA_build/"
TMP_PATH="/tmp/"
EXTRACTION_PATH="/tmp/test/"
VER_CHECK="/root/node_modules/noobaa-core/src/deploy/NVA_build/version_check.js"
NEW_UPGRADE_SCRIPT="${EXTRACTION_PATH}noobaa-core/src/deploy/NVA_build/upgrade.sh"
MONGO_SHELL="/usr/bin/mongo nbcore"

function disable_autostart {
  deploy_log "disable_autostart"
  # we need to start supervisord, but we don't want to start all services.
  # use sed to set autostart to false. replace back when finished.
  sed -i "s:autostart=true:autostart=false:" /etc/noobaa_supervisor.conf
  #web_server doesn't specify autostart. a hack to prevent it from loading
  sed -i "s:web_server.js:WEB.JS:" /etc/noobaa_supervisor.conf
}

function enable_autostart {
  deploy_log "enable_autostart"
  # restore autostart and web_server.js
  sed -i "s:autostart=false:autostart=true:" /etc/noobaa_supervisor.conf
  #web_server doesn't specify autostart. a hack to prevent it from loading
  sed -i "s:WEB.JS:web_server.js:" /etc/noobaa_supervisor.conf
}

function disable_supervisord {
  deploy_log "disable_supervisord"
  #services under supervisord
  local services=$($SUPERCTL status | grep pid | sed 's:.*pid \(.*\),.*:\1:')
  #disable the supervisord
  ${SUPERCTL} shutdown
  #kill services
  for s in ${services}; do
    deploy_log "Killing ${s}"
    kill -9 ${s}
  done

  local mongostatus=$(ps -ef|grep mongod)
  deploy_log "Mongo status after disabling supervisord $mongostatus"
}

function packages_upgrade {
    #fix SCL issue (preventing yum install/update)
    yum -y remove centos-release-SCL
    yum -y install centos-release-scl

    if yum list installed dialog >/dev/null 2>&1; then
        deploy_log "dialog installed"
    else
        deploy_log "installing dialog"
        yum install -y dialog
    fi

    if yum list installed vim >/dev/null 2>&1; then
        deploy_log "vim installed"
    else
        deploy_log "installing vim"
        yum install -y vim
    fi

    deploy_log "installing utils"
    yum install -y bind-utils
}

function mongo_upgrade {
  disable_autostart

  ${SUPERD}
  sleep 3

  ${SUPERCTL} start ${MONGO_PROGRAM}
  wait_for_mongo

  #MongoDB nbcore upgrade
  deploy_log "starting mongo data upgrade"
  local sec=$(cat /etc/noobaa_sec)
  local bcrypt_sec=$(/usr/local/bin/node ${CORE_DIR}/src/util/crypto_utils.js --bcrypt_password ${sec})
  local id=$(uuidgen | cut -f 1 -d'-')
  local ip=$(/sbin/ifconfig eth0 | grep 'inet addr:' | cut -d: -f2 | cut -f 1 -d' ')
  ${MONGO_SHELL} --eval "var param_secret='${sec}', param_bcrypt_secret='${bcrypt_sec}', param_ip='${ip}'" ${CORE_DIR}/src/deploy/NVA_build/mongo_upgrade.js
  deploy_log "finished mongo data upgrade"

  enable_autostart

  ${SUPERCTL} update
  ${SUPERCTL} start all
  sleep 3
}


function restart_webserver {
    ${SUPERCTL} stop webserver
    mongodown=true
    while ${mongodown}; do
    if netstat -na|grep LISTEN|grep :27017; then
            deploy_log mongo_${mongodown}
            mongodown=false
            deploy_log ${mongodown}
    else
            echo sleep
            sleep 1
    fi
    done

    #MongoDB nbcore upgrade
    deploy_log "starting mongo data upgrade"
    local sec=$(cat /etc/noobaa_sec)
    local bcrypt_sec=$(/usr/local/bin/node ${CORE_DIR}/src/util/crypto_utils.js --bcrypt_password ${sec})
    local id=$(uuidgen | cut -f 1 -d'-')
    local ip=$(/sbin/ifconfig eth0 | grep 'inet addr:' | cut -d: -f2 | cut -f 1 -d' ')
    ${MONGO_SHELL} --eval "var param_secret='${sec}', param_bcrypt_secret='${bcrypt_sec}', params_cluster_id='${id}', param_ip='${ip}'" ${CORE_DIR}/src/deploy/NVA_build/mongo_upgrade.js
    deploy_log "finished mongo data upgrade"

    ${SUPERCTL} start webserver
}

function setup_users {
	deploy_log "setting up mongo users for admin and nbcore databases"
	/usr/bin/mongo admin ${CORE_DIR}/src/deploy/NVA_build/mongo_setup_users.js
	deploy_log "setup_users done"
}


function restart_s3rver {
    ${SUPERCTL} restart s3rver
}

function check_latest_version {
  local current=$(grep CURRENT_VERSION $ENV_FILE | sed 's:.*=\(.*\):\1:')
  local path=$(node $VER_CHECK $current)
  deploy_log "Current version $current while path is $path"
  if [ "$path" != "" ]; then
    deploy_log "Upgrade needed, path ${path}"
    curl -sL ${path} > ${TMP_PATH}${PACKAGE_FILE_NAME} || true
    exit 1
  else
    deploy_log "Version is up to date"
    exit 0
  fi
}

function extract_package {
  #Clean previous extracted package
  rm -rf ${EXTRACTION_PATH}*
  #Create path and extract package
  mkdir -p ${EXTRACTION_PATH}
  cd ${EXTRACTION_PATH}
  cp ${TMP_PATH}${PACKAGE_FILE_NAME} .
  tar -xzvf ./${PACKAGE_FILE_NAME} >& /dev/null

  #If package can't be extracted, clean
  if [ $? -ne 0 ]; then
    deploy_log "Corrupted package file, could not open"
    rm -rf ${EXTRACTION_PATH}*
    exit 1
  fi

  # #test if package contains expected locations/files, for example build/Release/native_core.node
  # if [ -f "${EXTRACTION_PATH}noobaa-core/build/Release/native_core.node" ]; then
  #         deploy_log "native_core.node exists in temp extraction point, continue with upgrade"
  #         #test if build time is newer than current version build time
  #         if [ "${EXTRACTION_PATH}noobaa-core/build/Release/native_core.node" -nt "/root/node_modules/noobaa-core/build/Release/native_core.node" ]; then
  #             deploy_log "native_core.node exists and its newer than current version, continue with upgrade"
  #        else
  #            deploy_log "build time is older than current version, abort upgrade"
  #            rm -rf ${EXTRACTION_PATH}*
  #            exit 1
  #         fi
  # else
  #   deploy_log "native_core.node does not exists, abort upgrade"
  #   rm -rf ${EXTRACTION_PATH}*
  #   exit 1
  # fi
}

function do_upgrade {
  #Update packages before we stop services, minimize downtime
  packages_upgrade
  
  disable_supervisord

  if [ "$CLUSTER" != 'cluster' ]; then
    # remove auth flag from mongo if present
    sed -i "s:mongod --auth:mongod:" /etc/noobaa_supervisor.conf
    # add bind_ip flag to restrict access to local host only.
    local has_bindip=$(grep bind_ip /etc/noobaa_supervisor.conf | wc -l)
    if [ $has_bindip == '0' ]; then
      deploy_log "adding --bind_ip to noobaa_supervisor.conf"
      sed -i "s:--dbpath:--bind_ip 127.0.0.1 --dbpath:" /etc/noobaa_supervisor.conf
    fi
  fi

  unalias cp
  deploy_log "Tar extracted successfully, Running pre upgrade"
  ${WRAPPER_FILE_PATH}${WRAPPER_FILE_NAME} pre ${FSUFFIX}

  deploy_log "Backup of current version and extract of new"
  #Delete old backup
  rm -rf /backup
  #Backup and extract
  mv ${CORE_DIR} /backup
  mkdir ${CORE_DIR}
  mv ${TMP_PATH}${PACKAGE_FILE_NAME} /root/node_modules
  cd /root/node_modules
  deploy_log "Extracting new version"
  tar -xzvf ./${PACKAGE_FILE_NAME} >& /dev/null

  # move existing internal agnets_storage to new dir
  if [ -d /backup/agent_storage/ ]; then
    mv /backup/agent_storage/ ${CORE_DIR}
  fi

  # Re-setup Repos
  setup_repos

   if [ ! -d  /var/lib/mongo/cluster/shard1 ] || [ ! "$(ls -A /var/lib/mongo/cluster/shard1)" ]; then
        deploy_log "Moving mongo db files into new location"
        mkdir -p /var/lib/mongo/cluster/shard1
        chmod +x /var/lib/mongo/cluster/shard1
        cp -r /data/db/* /var/lib/mongo/cluster/shard1/
        mv /data/db /backup/old_db
    fi

  deploy_log "Running post upgrade"
  ${WRAPPER_FILE_PATH}${WRAPPER_FILE_NAME} post ${FSUFFIX}
  deploy_log "Finished post upgrade"

  mongo_upgrade
  wait_for_mongo

  #Update Mongo Upgrade status
  deploy_log "Updating system.upgrade on success"
  local id=$(${MONGO_SHELL} --eval "db.systems.find({},{'_id':'1'})" | grep _id | sed 's:.*ObjectId("\(.*\)").*:\1:')
  ${MONGO_SHELL} --eval "db.systems.update({'_id':ObjectId('${id}')},{\$set:{'upgrade':{'path':'','status':'UNAVAILABLE','error':''}}});"

  deploy_log "Upgrade finished successfully!"
}

function verify_supported_upgrade {
    local current_ver=$(grep version /root/node_modules/noobaa-core/package.json  | cut -f 2 -d':' | cut -f 2 -d'"')
    local second_digit=$(echo ${current_ver} | cut -f 2 -d'.')

    if [ ${second_digit} == "0" or ${second_digit} == "3" ]; then
        deploy_log "Unspported upgrade path from ${current_version}"
        #delibaratly no auth, this is an old version!
        #/usr/bin/mongo nbcore --eval "db.activitylogs.insert({level: 'info', desc: 'Upgrade is not supported from this version, please contact support'})"
        exit 1
    fi
}

#Node.js Cluster chnages the .spawn behavour. On a normal spawn FDs are not inherited,
#on a node cluster they are, which meand the listening ports of the webserver are inherited by this upgrade.
#murder them
fds=`lsof -p $$ | grep LISTEN | awk '{print $4}' | sed 's:\(.*\)u:\1:'`
deploy_log "Detected File Descriptors $fds"
for f in ${fds}; do
  eval "exec ${f}<&-"
done

if [ "$1" == "from_file" ]; then
  allargs="$@"
  shift
  if [ "$1" != "" ]; then
    deploy_log "upgrade.sh called for package extraction"
    cp -f $1 ${TMP_PATH}${PACKAGE_FILE_NAME}
    extract_package
    shift
    ${NEW_UPGRADE_SCRIPT} do_upgrade $@
  else
    deploy_log "upgrade.sh called with ${allargs}"
    echo "Must supply path to upgrade package"
    exit 1
  fi
else
  if [ "$1" == "do_upgrade" ]; then
    shift

    if [ "$1" == "fsuffix" ]; then
      shift
      LOG_FILE="/var/log/noobaa_deploy_${1}.log"
      FSUFFIX="$1"
      shift
    fi

    CLUSTER="$1"
    if [ "$CLUSTER" == 'cluster' ]; then
      RS_SERVERS=`grep MONGO_RS_URL /root/node_modules/noobaa-core/.env | cut -d'/' -f 3`
      # TODO: handle differenet shard
      set_mongo_cluster_mode
    fi


    deploy_log "upgrade.sh called with ${allargs}"
    verify_supported_upgrade #verify upgrade from ver > 0.4.5
    do_upgrade
    exit 0
  else
    deploy_log "upgrade.sh called with $@"
    check_latest_version
    should_upgrade=$?
    echo "should upgrade $should_upgrade"
    if [ ${should_upgrade} -eq 1 ]; then
      extract_package
      $(${NEW_UPGRADE_SCRIPT} do_upgrade)
    fi
  fi
fi

exit 0
