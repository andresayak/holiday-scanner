1) `cp backend_app/.env.example backend_app/.env`
2) Put your settings in `.env`

```
REDIS_PASSWORD=
MYSQL_ROOT_PASSWORD=
ANKR_PROVIDER_KEY=
ETHERSCAN_API=
ETH_PRIVAT_KEY_OR_MNEMONIC=
```

3) Run containers `docker-compose up -d`
4) Run migrations `docker-compose exec backend_app npm run typeorm migration:run`
5) Run command `docker-compose exec backend_app npm run cli scan:transactions <address> <page>`
6) Run command `docker-compose exec backend_app npm run cli scan:arbitrage`


