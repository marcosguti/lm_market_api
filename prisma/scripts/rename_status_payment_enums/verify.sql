#!/bin/sh
docker exec db_lm_market psql -U postgres -d lm_market -c "SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'OrderStatus');"