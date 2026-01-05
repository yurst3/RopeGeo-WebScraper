# WebScraper
This repo contains code for lambda functions which scrape data from various canyoneering websites. This data is then parsed and stored in a Postgresql database for use by the <App> API.

## Ropewiki
[Ropewiki.com](https://ropewiki.com/Main_Page) is a public repository for information on canyoneering (canyoning), caving, and other single rope technique related disciplines. As of January 2026, it has approximately 11,500 pages of canyoneering, caving, and hiking locations contained in approximately 900 regions around the world. Anyone with a free ropewiki account can upload their own pages or contribute to the pages of others. All data on ropewiki is licensed under [Creative Commons Attribution Non-Commercial Share Alike](https://creativecommons.org/licenses/by-nc-sa/3.0/), which means that we are free to scrape their data and adapt it however we like as long as we give credit to the original author(s), don't use the data for commercial purposes, and use the same license for our copy of their data.

Ropewiki is powered by [MediaWiki](https://www.mediawiki.org/wiki/MediaWiki), which means it has an [API](https://www.mediawiki.org/wiki/API:Action_API) that makes scraping page data a lot more convenient. We make liberal use of their API along with [Puppeteer](https://pptr.dev/), a web browsing automation tool, to extract information for all their pages into our own database. The scraping process looks like this:
1. Get data for all regions
    * Check the latest revision date for the [Regions](https://ropewiki.com/Regions) page
    * If we don't have any regions in our database or the revision data is more recent than our regions' updatedAt date
        * Use the API to pull the [Regions](https://ropewiki.com/Regions) page HTML
        * Use puppeteer & headless chrome browser to parse the HTML into JSON data
        * Upsert the JSON data into our database
    * If we have regions and the revision date is older than our regions' updatedAt date
        * Skip parsing the [Regions](https://ropewiki.com/Regions) page and get the regions from our database

2. Determine which set of regions we're able to get all the page data for (API pagination limits us to an offset of 5000 and a limit of 2000)
    * Start with the set that contains just the root region "World"
    * Until all regions in the set have a page count less than 6000 
        * Find which regions have a page count over 6000
        * Get children of those regions
        * Replace the over-limit parent regions in the set with the children

3. Get all pages for each region in the set
    * For each page in each region
        * Use the API to pull the page's properties (title, rating, difficulty, etc.)
        * Use the API to pull the page's HTML data
        * Use puppeteer to parse the page's HTML data into beta sections and images
        * Upsert the page properties, beta sections, and images into the database
        * Mark old beta sections and images as "deleted"

Note: All of the API queries are done sequentially so we don't hit any API request limits or crash ropewiki's server. We make full use of pagination to get as much data as we can per request, but it still takes roughly 4-5 hours to do a complete scrape of all data from ropewiki. This is far in excess of Lambda's max timeout value of 15 minutes, so if we ever need to populate the production/dev databases from scratch we have to run the scraper locally and manually dump/restore the data to RDS. However, in an ongoing maintenance/sync run 15 minutes should be more than enough time for a Lambda to query, parse, and upsert the few pages with new revisions. 

## Prereqs for local development
1. Download and install [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
2. Download and install [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)
3. Download and install [Docker](https://docs.docker.com/desktop)
4. Ask Ethan to make you an AWS IAM user OR [create your account](https://aws.amazon.com/)
5. Run `npm install` to install all package dependencies
6. Run `npx @puppeteer/browsers install chrome` to install Chrome for Testing
7. (Optional, Recommended) Download and install a database browser of your choice. Personally I recommend [DBeaver](https://dbeaver.io/)

## Scripts
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
