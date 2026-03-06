-- migrate:up
ALTER TABLE "RopewikiRegion" RENAME COLUMN "parentRegion" TO "parentRegionName";
ALTER TABLE "RopewikiRegion" RENAME CONSTRAINT "uk_ropewikiRegion_name_parentRegion" TO "uk_ropewikiRegion_name_parentRegionName";

-- migrate:down
ALTER TABLE "RopewikiRegion" RENAME CONSTRAINT "uk_ropewikiRegion_name_parentRegionName" TO "uk_ropewikiRegion_name_parentRegion";
ALTER TABLE "RopewikiRegion" RENAME COLUMN "parentRegionName" TO "parentRegion";
