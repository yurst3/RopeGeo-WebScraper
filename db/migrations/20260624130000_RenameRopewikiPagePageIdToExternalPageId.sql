-- migrate:up

ALTER TABLE "RopewikiPage"
    RENAME COLUMN "pageId" TO "externalPageId";

ALTER TABLE "RopewikiPage"
    RENAME CONSTRAINT "uk_ropewikiPage_pageId" TO "uk_ropewikiPage_externalPageId";

ALTER INDEX "RopewikiPage_pageId_index"
    RENAME TO "RopewikiPage_externalPageId_index";

-- migrate:down

ALTER INDEX "RopewikiPage_externalPageId_index"
    RENAME TO "RopewikiPage_pageId_index";

ALTER TABLE "RopewikiPage"
    RENAME CONSTRAINT "uk_ropewikiPage_externalPageId" TO "uk_ropewikiPage_pageId";

ALTER TABLE "RopewikiPage"
    RENAME COLUMN "externalPageId" TO "pageId";
