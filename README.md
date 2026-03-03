# WebScraper
This repo contains code for lambda functions which scrape data from various canyoneering websites. This data is then parsed and stored in a Postgresql database for use by the <App> API.

## Ropewiki
[Ropewiki.com](https://ropewiki.com/Main_Page) is a public repository for information on canyoneering (canyoning), caving, and other single rope technique related disciplines. As of January 2026, it has approximately 11,500 pages of canyoneering, caving, and hiking locations contained in approximately 900 regions around the world. Anyone with a free ropewiki account can upload their own pages or contribute to the pages of others. All data on ropewiki is licensed under [Creative Commons Attribution Non-Commercial Share Alike](https://creativecommons.org/licenses/by-nc-sa/3.0/), which means that we are free to scrape their data and adapt it however we like as long as we give credit to the original author(s), don't use the data for commercial purposes, and use the same license for our copy of their data.

Ropewiki is powered by [MediaWiki](https://www.mediawiki.org/wiki/MediaWiki) and [Semantic MediaWiki](https://www.semantic-mediawiki.org/wiki/Semantic_MediaWiki), which means it has an [API](https://www.mediawiki.org/wiki/API:Action_API) that makes scraping page data a lot more convenient. We make liberal use of their API along with [Puppeteer](https://pptr.dev/), a web browsing automation tool, to extract information for all their pages into our own database. The scraping process looks like this:
1. Get data for all regions
    * Use Semantic MediaWiki query to get everything under the "Region" category
    * Upsert all the regions into the database
        * We always want to upsert instead of checking the latest revision date so that the page counts are always up to date

2. Determine which set of regions we're able to get all the page data for (API pagination limits us to an offset of 5000 and a limit of 2000)
    * Start with the set that contains just the root region "World"
    * Until all regions in the set have a page count less than 6000 
        * Find which regions have a page count over 6000
        * Get children of those regions
        * Replace the over-limit parent regions in the set with the children

3. Get all pages for each region in the set
    * For each page in each region
        * Use the API to pull the page's properties (title, rating, difficulty, etc.)
        * Upsert the pages into the database
        * Determin which pages need to be parsed by checking which ones have been updated recently
        * For each page that needs to be parsed:
            * Use puppeteer to parse the page's HTML data into beta sections and images
            * Upsert the page properties, beta sections, and images into the database
            * Mark old beta sections and images as "deleted"

4. Upsert Routes for all pages that have been updated
    * Filter the updated pages to just the ones that have coordinates
    * Get the Routes for pages that have routes
    * Correlate any pages that have routes made by another scraper
    * Update the existing Routes
    * Create Routes for Pages without routes
    * Upsert PageRoutes for all pages and routes
    * Filter PageRoutes to select only the ones with map data
    * For each PageRoute that has map data:
        * Process its map data
        * Save its map data to either S3 or a local directory
        * Upsert the database entry for the PageRoute

Note: All of the API queries are done sequentially so we don't hit any API request limits or crash ropewiki's server. We make full use of pagination to get as much data as we can per request, but it still takes roughly 3.5 hours to do a complete scrape of all data from ropewiki. This is far in excess of Lambda's max timeout value of 15 minutes, so if we ever need to populate the production/dev databases from scratch we have to run the scraper locally and manually dump/restore the data to RDS. However, in an ongoing maintenance/sync run 15 minutes should be more than enough time for a Lambda to query, parse, and upsert the few pages with new revisions. 

## Fargate tasks (running locally)

Scheduled ECS Fargate tasks live under `src/fargate-tasks/<taskName>/`. Each task has a `main.ts` entrypoint and can be run locally with the same env vars it gets in AWS (DB, bucket names, etc.).

**Run any Fargate task locally:**

1. Start the local DB if the task needs it: `npm run local-db:start`
2. Set env vars and run the job’s main module:
   ```bash
   DB_HOST=127.0.0.1 DB_PORT=8081 DB_NAME=local DB_USER=localUser DB_PASSWORD=localPass \
   DEV_ENVIRONMENT=local \
   npx ts-node --files src/fargate-tasks/<taskFolder>/main.ts
   ```
   Add any task-specific vars (e.g. `MAP_DATA_BUCKET_NAME=dev-map-data-bucket` for tasks that upload to S3). With `DEV_ENVIRONMENT=local`, S3 uploads and CloudFront invalidations are typically skipped.
3. Some tasks use external tools (e.g. Tippecanoe); install them for full behavior, or run without for partial testing.

**Build and push images:** The pipeline builds and pushes all Fargate task images after a main stack deploy. To build/push manually, get the task's ECR URI from the stack output `<Prefix>RepositoryUri`, then `docker build -f src/fargate-tasks/<taskFolder>/Dockerfile -t <uri> .` and `docker push <uri>`. See `.cursor/rules/fargate-tasks.mdc` for the full convention.

### Running Fargate tasks from the AWS console

You can run a Fargate task once from the ECS console (e.g. to re-run a tile task without waiting for the schedule):

1. In **AWS Console** go to **ECS** → **Clusters** → select the cluster that hosts the task (e.g. the one created by the WebScraper stack).
2. Open the **Tasks** tab, click **Run new task**.
3. Choose **Fargate**, the correct **Task definition** (e.g. `generateTrailTiles` or `generateRouteMarkerTiles`), the right **Cluster**, and **Launch type** Fargate.
4. Under **Networking** (or **VPC and security groups**), set:
   - **VPC:** `WebScraperVPC`
   - **Security group:** `WebScraper-Prod-LambdaSecurityGroup`  
   Without these, the task may not reach RDS or S3.
5. Run the task. Check **Logs** in the task detail for progress and errors.

## RDS IAM authentication (direct connect)

When not using RDS Proxy (`UseDatabaseProxy` = `false`), Lambdas and Fargate tasks connect to RDS using IAM database authentication. The stack enables this on the DB instance; you need two one-time steps:

1. **Grant `rds_iam` to the DB user** (run once per environment, e.g. via bastion or a one-off connect):
   ```sql
   GRANT rds_iam TO "your_db_username";
   ```
   Use the same username as the `DatabaseUsername` stack parameter.

2. **Set the `RdsDbiResourceId` parameter** so IAM roles can call `rds-db:connect`. After the first deploy, get the DBI resource ID from the RDS console (instance → Configuration) or:
   ```bash
   aws rds describe-db-instances --db-instance-identifier <devEnvironment>-db --query 'DBInstances[0].DbiResourceId' --output text
   ```
   Then update the stack (e.g. via pipeline or AWS Console) with `RdsDbiResourceId` = that value (e.g. `db-0ABCD1234`).

## Prereqs for local development
1. Download and install [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
2. Download and install [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)
3. Download and install [Docker](https://docs.docker.com/desktop)
4. Ask Ethan to make you an AWS IAM user OR [create your account](https://aws.amazon.com/)
5. Run `npm install` to install all package dependencies
6. Run `npx puppeteer browsers install chrome` to install Chrome for Testing
7. Install [Tippecanoe](https://github.com/mapbox/tippecanoe) for converting map data files into Mapbox Vector Tiles
8. (Optional, Recommended) Download and install a database browser of your choice. Personally I recommend [DBeaver](https://dbeaver.io/)

## Scripts
* `npm run merge:main-template` - Merges all YAML under `cloudformation/stacks/main/` into `cloudformation/stacks/mergedMainTemplate.yaml` (used by SAM build and deploy). Uses the [cloudformation-yml-merger](https://github.com/dakoo/cloudformation-yml-merger) package via `scripts/mergeTemplate.ts`.
* `npm run merge:api-template` - Merges all YAML under `cloudformation/stacks/api/` into `cloudformation/stacks/mergedApiTemplate.yaml` (used by API stack deploy in the pipeline). Uses the same package via `scripts/mergeTemplate.ts`.
* `npm run scrape-lambda:ropewiki` - Builds the RopewikiScraper lambda function and invokes it with events/RopewikiScraperCronEvent.json. MUST RUN `npm run local-db:start` BEFORE THIS. MUST RUN `aws login` BEFORE THIS. LAMBDA WILL TIME OUT AFTER 900 SECONDS (15 MINUTES).
* `npm run scrape:ropewiki` - Runs RopewikiScraper as a node script. MUST RUN `npm run local-db:start` BEFORE THIS
* `npm run lint:dev` - Runs eslint in "fix" mode (will attempt to fix lint errors)
* `npm run migrate:up` - Runs all of the database migrations on the local db. Used by `local-db:start`
* `npm run migrate-test:up` - Runs all of the database migrations on the test db. Used by `test-db:start`
* `npm run local-db:start` - Starts a postgres docker container called "local-db" and runs all of the database migrations on the container
* `npm run local-db:stop` - Stops the "local-db" docker container
* `npm run test-db:start` - Starts a postgres docker container called "test-db" and runs all of the database migrations on the container
* `npm run test-db:delete` - Stops and deletes the "test-db" docker container
* `npm run test:unit` - Runs all of the jest tests EXCLUDING the database tests
* `npm run test:database` - Runs only the database tests. MUST RUN `npm run test-db:start` OR THE TESTS WILL FAIL
* `npm run test:local` - Runs ALL jest tests, spinning up a "test-db" postgres docker container for the database tests and deleting it afterwards
* `npm run test:deploy` - Runs ALL jest tests WITHOUT creating a "test-db" container. Used in the "test" job in the "pipeline" workflow
