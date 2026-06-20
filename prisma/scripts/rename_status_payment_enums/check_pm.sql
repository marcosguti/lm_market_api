#!/bin/sh
docker exec db_lm_market psql -U postgres -d lm_market -c "SELECT typname FROM pg_type WHERE typname = 'PaymentMethod';"