\restrict 398nWUpQtAHtZUkkAhiH6joFGPoU24K2kVZHLT0cRi7tvcTa1hYaNnpKNPlrX6q

-- Dumped from database version 18.1 (Debian 18.1-1.pgdg13+2)
-- Dumped by pg_dump version 18.1 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: MapData; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MapData" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gpx text,
    kml text,
    "geoJson" text,
    "vectorTile" text,
    "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deletedAt" timestamp without time zone,
    "sourceFileUrl" text DEFAULT ''::text NOT NULL,
    "errorMessage" text
);


--
-- Name: RopewikiBetaSection; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RopewikiBetaSection" (
    id uuid DEFAULT gen_random_uuid() CONSTRAINT "RopewikiPageBetaSection_id_not_null" NOT NULL,
    "ropewikiPage" uuid CONSTRAINT "RopewikiPageBetaSection_ropewikiPage_not_null" NOT NULL,
    title text CONSTRAINT "RopewikiPageBetaSection_title_not_null" NOT NULL,
    text text CONSTRAINT "RopewikiPageBetaSection_text_not_null" NOT NULL,
    "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP CONSTRAINT "RopewikiPageBetaSection_createdAt_not_null" NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP CONSTRAINT "RopewikiPageBetaSection_updatedAt_not_null" NOT NULL,
    "deletedAt" timestamp without time zone,
    "latestRevisionDate" timestamp without time zone DEFAULT CURRENT_TIMESTAMP CONSTRAINT "RopewikiPageBetaSection_latestRevisionDate_not_null" NOT NULL,
    "order" integer,
    CONSTRAINT "chk_ropewikiPageBetaSection_order_null_only_when_deleted" CHECK ((("order" IS NOT NULL) OR ("deletedAt" IS NOT NULL)))
);


--
-- Name: RopewikiImage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RopewikiImage" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "ropewikiPage" uuid NOT NULL,
    "betaSection" uuid,
    "linkUrl" text NOT NULL,
    "fileUrl" text NOT NULL,
    caption text,
    "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deletedAt" timestamp without time zone,
    "latestRevisionDate" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "order" integer,
    CONSTRAINT "chk_ropewikiImage_order_null_only_when_deleted" CHECK ((("order" IS NOT NULL) OR ("deletedAt" IS NOT NULL)))
);


--
-- Name: RopewikiPage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RopewikiPage" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "pageId" text NOT NULL,
    name text NOT NULL,
    region uuid NOT NULL,
    url text NOT NULL,
    rating text,
    "timeRating" text,
    "kmlUrl" text,
    "technicalRating" text,
    "waterRating" text,
    "riskRating" text,
    permits text,
    "rappelCount" integer,
    vehicle text,
    quality numeric,
    coordinates jsonb,
    "rappelLongest" jsonb,
    "shuttleTime" jsonb,
    "minOverallTime" jsonb,
    "maxOverallTime" jsonb,
    "hikeLength" jsonb,
    months jsonb,
    "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deletedAt" timestamp without time zone,
    "latestRevisionDate" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "rappelInfo" text,
    aka jsonb,
    "userVotes" integer,
    "overallLength" jsonb,
    "minApproachTime" jsonb,
    "maxApproachTime" jsonb,
    "minDescentTime" jsonb,
    "maxDescentTime" jsonb,
    "minExitTime" jsonb,
    "maxExitTime" jsonb,
    "approachElevGain" jsonb,
    "exitElevGain" jsonb
);


--
-- Name: RopewikiPageSiteLink; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RopewikiPageSiteLink" (
    page uuid NOT NULL,
    "siteLink" uuid NOT NULL,
    "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deletedAt" timestamp without time zone
);


--
-- Name: RopewikiRegion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RopewikiRegion" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "parentRegion" text,
    name text NOT NULL,
    "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deletedAt" timestamp without time zone,
    "latestRevisionDate" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "pageCount" integer NOT NULL,
    level integer NOT NULL,
    overview text,
    "bestMonths" jsonb NOT NULL,
    "isMajorRegion" boolean,
    "isTopLevelRegion" boolean,
    url text NOT NULL
);


--
-- Name: RopewikiRoute; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RopewikiRoute" (
    route uuid NOT NULL,
    "ropewikiPage" uuid NOT NULL,
    "mapData" uuid,
    "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deletedAt" timestamp without time zone
);


--
-- Name: RopewikiSiteLink; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RopewikiSiteLink" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    url text NOT NULL,
    "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deletedAt" timestamp without time zone
);


--
-- Name: Route; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Route" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    coordinates jsonb NOT NULL,
    "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deletedAt" timestamp without time zone
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version character varying NOT NULL
);


--
-- Name: MapData MapData_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MapData"
    ADD CONSTRAINT "MapData_pkey" PRIMARY KEY (id);


--
-- Name: RopewikiImage RopewikiImage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RopewikiImage"
    ADD CONSTRAINT "RopewikiImage_pkey" PRIMARY KEY (id);


--
-- Name: RopewikiBetaSection RopewikiPageBetaSection_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RopewikiBetaSection"
    ADD CONSTRAINT "RopewikiPageBetaSection_pkey" PRIMARY KEY (id);


--
-- Name: RopewikiPage RopewikiPage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RopewikiPage"
    ADD CONSTRAINT "RopewikiPage_pkey" PRIMARY KEY (id);


--
-- Name: RopewikiRegion RopewikiRegion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RopewikiRegion"
    ADD CONSTRAINT "RopewikiRegion_pkey" PRIMARY KEY (id);


--
-- Name: RopewikiSiteLink RopewikiSiteLink_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RopewikiSiteLink"
    ADD CONSTRAINT "RopewikiSiteLink_pkey" PRIMARY KEY (id);


--
-- Name: Route Route_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Route"
    ADD CONSTRAINT "Route_pkey" PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: RopewikiImage uk_ropewikiImage_ropewikiPage_betaSection_fileUrl; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RopewikiImage"
    ADD CONSTRAINT "uk_ropewikiImage_ropewikiPage_betaSection_fileUrl" UNIQUE NULLS NOT DISTINCT ("ropewikiPage", "betaSection", "fileUrl");


--
-- Name: RopewikiBetaSection uk_ropewikiPageBetaSection_ropewikiPage_order; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RopewikiBetaSection"
    ADD CONSTRAINT "uk_ropewikiPageBetaSection_ropewikiPage_order" UNIQUE ("ropewikiPage", "order");


--
-- Name: RopewikiBetaSection uk_ropewikiPageBetaSection_ropewikiPage_title; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RopewikiBetaSection"
    ADD CONSTRAINT "uk_ropewikiPageBetaSection_ropewikiPage_title" UNIQUE ("ropewikiPage", title);


--
-- Name: RopewikiPageSiteLink uk_ropewikiPageSiteLink_page_siteLink; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RopewikiPageSiteLink"
    ADD CONSTRAINT "uk_ropewikiPageSiteLink_page_siteLink" UNIQUE (page, "siteLink");


--
-- Name: RopewikiPage uk_ropewikiPage_pageId; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RopewikiPage"
    ADD CONSTRAINT "uk_ropewikiPage_pageId" UNIQUE ("pageId");


--
-- Name: RopewikiRegion uk_ropewikiRegion_name_parentRegion; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RopewikiRegion"
    ADD CONSTRAINT "uk_ropewikiRegion_name_parentRegion" UNIQUE NULLS NOT DISTINCT (name, "parentRegion");


--
-- Name: RopewikiRoute uk_ropewikiRoute_ropewikiPage; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RopewikiRoute"
    ADD CONSTRAINT "uk_ropewikiRoute_ropewikiPage" UNIQUE ("ropewikiPage");


--
-- Name: RopewikiRoute uk_ropewikiRoute_route_ropewikiPage; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RopewikiRoute"
    ADD CONSTRAINT "uk_ropewikiRoute_route_ropewikiPage" UNIQUE (route, "ropewikiPage");


--
-- Name: RopewikiSiteLink uk_ropewikiSiteLink_url; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RopewikiSiteLink"
    ADD CONSTRAINT "uk_ropewikiSiteLink_url" UNIQUE (url);


--
-- Name: RopewikiPage_pageId_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RopewikiPage_pageId_index" ON public."RopewikiPage" USING btree ("pageId");


--
-- Name: uk_ropewikiImage_ropewikiPage_betaSection_order; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "uk_ropewikiImage_ropewikiPage_betaSection_order" ON public."RopewikiImage" USING btree ("ropewikiPage", "betaSection", "order") NULLS NOT DISTINCT WHERE ("order" IS NOT NULL);


--
-- Name: RopewikiImage fk_ropewikiImage_betaSection; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RopewikiImage"
    ADD CONSTRAINT "fk_ropewikiImage_betaSection" FOREIGN KEY ("betaSection") REFERENCES public."RopewikiBetaSection"(id);


--
-- Name: RopewikiImage fk_ropewikiImage_ropewikiPage; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RopewikiImage"
    ADD CONSTRAINT "fk_ropewikiImage_ropewikiPage" FOREIGN KEY ("ropewikiPage") REFERENCES public."RopewikiPage"(id);


--
-- Name: RopewikiBetaSection fk_ropewikiPageBetaSection_ropewikiPage; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RopewikiBetaSection"
    ADD CONSTRAINT "fk_ropewikiPageBetaSection_ropewikiPage" FOREIGN KEY ("ropewikiPage") REFERENCES public."RopewikiPage"(id);


--
-- Name: RopewikiPageSiteLink fk_ropewikiPageSiteLink_page; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RopewikiPageSiteLink"
    ADD CONSTRAINT "fk_ropewikiPageSiteLink_page" FOREIGN KEY (page) REFERENCES public."RopewikiPage"(id);


--
-- Name: RopewikiPageSiteLink fk_ropewikiPageSiteLink_siteLink; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RopewikiPageSiteLink"
    ADD CONSTRAINT "fk_ropewikiPageSiteLink_siteLink" FOREIGN KEY ("siteLink") REFERENCES public."RopewikiSiteLink"(id);


--
-- Name: RopewikiPage fk_ropewikiPage_region; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RopewikiPage"
    ADD CONSTRAINT "fk_ropewikiPage_region" FOREIGN KEY (region) REFERENCES public."RopewikiRegion"(id);


--
-- Name: RopewikiRoute fk_ropewikiRoute_mapData; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RopewikiRoute"
    ADD CONSTRAINT "fk_ropewikiRoute_mapData" FOREIGN KEY ("mapData") REFERENCES public."MapData"(id);


--
-- Name: RopewikiRoute fk_ropewikiRoute_ropewikiPage; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RopewikiRoute"
    ADD CONSTRAINT "fk_ropewikiRoute_ropewikiPage" FOREIGN KEY ("ropewikiPage") REFERENCES public."RopewikiPage"(id);


--
-- Name: RopewikiRoute fk_ropewikiRoute_route; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RopewikiRoute"
    ADD CONSTRAINT "fk_ropewikiRoute_route" FOREIGN KEY (route) REFERENCES public."Route"(id);


--
-- PostgreSQL database dump complete
--

\unrestrict 398nWUpQtAHtZUkkAhiH6joFGPoU24K2kVZHLT0cRi7tvcTa1hYaNnpKNPlrX6q


--
-- Dbmate schema migrations
--

INSERT INTO public.schema_migrations (version) VALUES
    ('20251217200307'),
    ('20251218183945'),
    ('20251218202306'),
    ('20251219182510'),
    ('20251219191048'),
    ('20251227152406'),
    ('20260107210617'),
    ('20260108192140'),
    ('20260112211225'),
    ('20260112234228'),
    ('20260117175122'),
    ('20260117184634'),
    ('20260120163351'),
    ('20260120174146'),
    ('20260121110901'),
    ('20260121120000'),
    ('20260206120000'),
    ('20260206130000'),
    ('20260206140000'),
    ('20260206150000'),
    ('20260302170000');
