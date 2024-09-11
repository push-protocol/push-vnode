#!/bin/bash
echo "" > /docker-entrypoint-initdb.d/grant-privileges.sql

# create user
# user is being created by docker-compose param MYSQL_USER
# additional users can be crated like this
# echo "CREATE USER '${MYSQL_USER}'@'%' IDENTIFIED BY '${MYSQL_PASSWORD}';" >> /docker-entrypoint-initdb.d/grant-privileges.sql

# grant all permissions to every test db we have
echo "CREATE DATABASE vnode1 CHARACTER SET utf8 COLLATE utf8_general_ci; " >> /docker-entrypoint-initdb.d/grant-privileges.sql
echo "GRANT ALL PRIVILEGES ON vnode1.* TO '${MYSQL_USER}'@'%';  " >> /docker-entrypoint-initdb.d/grant-privileges.sql

echo "CREATE DATABASE vnode2 CHARACTER SET utf8 COLLATE utf8_general_ci;" >> /docker-entrypoint-initdb.d/grant-privileges.sql
echo "GRANT ALL PRIVILEGES ON vnode2.* TO '${MYSQL_USER}'@'%';  " >> /docker-entrypoint-initdb.d/grant-privileges.sql

echo "CREATE DATABASE vnode3 CHARACTER SET utf8 COLLATE utf8_general_ci;" >> /docker-entrypoint-initdb.d/grant-privileges.sql
echo "GRANT ALL PRIVILEGES ON vnode3.* TO '${MYSQL_USER}'@'%';  " >> /docker-entrypoint-initdb.d/grant-privileges.sql

# apply
echo "FLUSH PRIVILEGES;" >> /docker-entrypoint-initdb.d/grant-privileges.sql


echo "FINAL GENERATED SQL:"
cat /docker-entrypoint-initdb.d/grant-privileges.sql
