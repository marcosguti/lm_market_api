### Requirements

- node v22.21.1
- npm v10.9.4
- docker

### Project installation

1. Copy the env template and set your values
   `cp .env_template .env`
2. Creates a Docker image
   `npm run createImageDB`
3. Creates a DB docker container
   `npm run createContainerDB`
4. Install dependencies
   `npm i`
5. Run initial migrations
   `npm run runMigrationDev`
6. Update DB
   `npm run updateDB`
7. Run
   `npm run dev`

If the installation was successful, the server will be up in the port 3000

### Run project

1. Run
   `npm run dev`

### Run project with new empty DB

1. Stop server
2. Run
   `npm run removeContainerDB`
3. Delete manually the folder `db_data`, this folder is in the project root
4. Creates a DB docker container
   `npm run createContainerDB`
5. Run initial migrations
   `npm run runMigrationDev`
6. Update DB
   `npm run updateDB`

### Save DB

1. Stop server
2. Run
   `npm run saveDB`

### Load DB

1. Stop server
2. Copy the file `backup.dump` to folder `loadDB`
3. Run
   `npm run loadDB`
4. Run migrations
   `npm run runMigrationDev`
5. Update DB
   `npm run updateDB`

### Run migrations and update DB models

1. Stop server
2. Run (replace MIGRATION_NAME with the migration name)
   `npm run runMigrationDev -- MIGRATION_NAME`
