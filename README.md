# WebScraper
This repo contains code for lambda functions which scrape data from various canyoneering websites. This data is then parsed and stored in a Postgresql database for use by the <App> API.

## Prereqs for local development
1. Download and install [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
2. Download and install [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)
3. Download and install [Docker](https://docs.docker.com/desktop)
4. Run `npm install` to install all package dependencies
5. (Optional, Recommended) Download and install a database browser of your choice. Personally I recommend [DBeaver](https://dbeaver.io/)

## Scripts
`npm run migrate-test:up` - Runs all of the database migrations on the test db. Used by `test-db:start`
`npm run test-db:start` - Starts a postgres docker container called "test-db" and runs all of the database migrations on the container
`npm run test-db:delete` - Stops and deletes the "test-db" docker container
`npm run test:unit` - Runs all of the jest tests EXCLUDING the database tests
`npm run test:database` - Runs only the database tests. MUST RUN `npm run test-db:start` OR THE TESTS WILL FAIL
`npm run test:local` - Runs ALL jest tests, spinning up a "test-db" postgres docker container for the database tests and deleting it afterwards
`npm run test:deploy` - Runs ALL jest tests WITHOUT creating a "test-db" container. Used in the "test" job in the "pipeline" workflow
