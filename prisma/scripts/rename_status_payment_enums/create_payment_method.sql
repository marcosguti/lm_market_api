#!/bin/sh
docker exec db_lm_market psql -U postgres -d lm_market -c "CREATE TYPE \"PaymentMethod\" AS ENUM ('cash', 'zelle', 'mobilePayment', 'binance');"