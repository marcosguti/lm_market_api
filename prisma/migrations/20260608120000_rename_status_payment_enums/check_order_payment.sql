#!/bin/sh
docker exec db_lm_market psql -U postgres -d lm_market -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'Order' AND column_name LIKE 'payment%';"