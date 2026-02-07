-- migrate:up

ALTER TABLE "RopewikiPageBetaSection" RENAME TO "RopewikiBetaSection";

-- migrate:down

ALTER TABLE "RopewikiBetaSection" RENAME TO "RopewikiPageBetaSection";
